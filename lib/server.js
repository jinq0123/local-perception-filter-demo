"use strict"

module.exports = function(tr) {
  return new Server(tr)
}

var Client = require("./client.js")
var StateTrajectories = require("./trajectories.js")
var Channel = require("./local-channel.js")

function Server(tickStep) {
  this.tickCount = 0
  this.tickStep = tickStep
  this.state = new StateTrajectories()
  this.clientEvents = []
  this.clientChannels = []
  this.clients = []
  // 每帧调用 this.tick()
  this.tickInterval = setInterval(this.tick.bind(this), tickStep)
}

var proto = Server.prototype

proto.setTickStep = function(step) {
  this.tickStep = step
  clearInterval(this.tickInterval)
  this.tickInterval = setInterval(this.tick.bind(this), step)
  for(var i=0; i<this.clients.length; ++i) {
    this.clients[i].tickStep = step
  }
}

proto.createClient = function(lag, x) {
  var toClient = new Channel(lag)
  var fromClient = new Channel(lag)
  // clientEvents 好像没用?
  this.clientEvents.push(fromClient.events)
  // 向管道发送事件，会自动延时触发，触发时添加新的状态
  this.state.listen(fromClient.events)
  // 同时，事件也会广播出去
  var bcast = this.broadcast.bind(this)
  fromClient.events.on("create", function(id, x, v, t) {
    bcast(["create", id, x, v, t], toClient)
  })
  fromClient.events.on("move", function(id, x, v, t) {
    bcast(["move", id, x, v, t], toClient)
  })
  fromClient.events.on("delete", function(id, x, v, t) {
    bcast(["delete", id, x, v, t], toClient)
  })
  // clientChannels 用来向所有客户端广播
  this.clientChannels.push(toClient)
  var client = new Client(this.tickCount, this.tickStep, fromClient, toClient)
  this.clients.push(client)
  var curTime = this.tickCount
  var cparticles = this.state.getState(function(x,y) {
    return curTime
  })
  for(var id in cparticles) {
    var p = cparticles[id]
    toClient.send("create", id|0, p.x, p.v, curTime)
  }
  client.createCharacter(x)
  return client
}

proto.broadcast = function(msg, skip) {
  for(var i=0; i<this.clientChannels.length; ++i) {
    if(this.clientChannels[i] === skip) {
      continue
    }
    this.clientChannels[i].send.apply(this.clientChannels[i], msg)
  }
}

proto.tick = function() {
  this.tickCount += 1
  this.broadcast(["tick", this.tickCount])
}