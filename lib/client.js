"use strict"

module.exports = Client

var StateTrajectories = require("./trajectories.js")

function Client(tickCount, tickRate, outChannel, inChannel) {
  this.lag = inChannel.lag
  this.tickCount = tickCount
  this.lastRemoteTick = Date.now()
  this.tickRate = tickRate
  this.state = new StateTrajectories()
  this.events = inChannel.events
  this.channel = outChannel
  this.inputChannel = inChannel
  this.state.listen(this.events)
  this.character = 0
  this.lastVelocity = [1, 0]

  var cl = this
  this.events.on("tick", function(t) {
    // 每帧记录本次帧号和时戳
    // 由服务器广播帧号
    cl.tickCount = t
    cl.lastRemoteTick = Date.now()
  })
}

var proto = Client.prototype

proto.setLag = function(lag) {
  this.lag = this.inputChannel.lag = this.channel.lag = lag
}

// 本地帧号 = 上次帧号 + (当前时间 - 上帧时间) / 帧间隔
// 当前时间对应的帧号
proto.localTick = function() {
  var d = Date.now() - this.lastRemoteTick
  return this.tickCount + d / this.tickRate
}

proto.createCharacter = function(x) {
  var t = this.localTick()
  var id = this.state.createParticle(null, x, [0,0], t)
  this.channel.send("create", id, x, [0,0], t)
  this.character = id
}

proto.setVelocity = function(v) {
  var t = this.localTick()
  var s = this.state.getParticle(this.character, t)

  //only update velocity if necessary
  var dx = v[0] - s.v[0]
  var dy = v[1] - s.v[1]
  if(dx * dx + dy * dy < 1e-6) {
    return
  }

  //Set new velocity
  var x = s.x
  this.state.moveParticle(this.character, x, v, t)
  this.channel.send("move", this.character, x, v, t)
  if(v[0] * v[0] + v[1] * v[1] > 1e-6) {
    this.lastVelocity = v.slice()
  }
}

proto.shoot = function(vel) {
  var t = this.localTick()
  var v = [this.lastVelocity[0], this.lastVelocity[1]]
  var vl = v[0] * v[0] + v[1] * v[1]
  if(vl < 1e-6) {
    v = [vel, 0]
  } else {
    vl = vel / Math.sqrt(vl)
    v = [v[0] * vl, v[1] * vl]
  }
  var x = this.state.getParticle(this.character, t).x
  var id = this.state.createParticle(null, x, v, t)
  this.channel.send("create", id, x, v, t)
  return id
}