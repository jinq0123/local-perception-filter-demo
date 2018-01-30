"use strict"

module.exports = StateTrajectories

var bsearch = require("binary-search-bounds")
var hermite = require("cubic-hermite")


function createId() {
  return (Math.random() * (1<<10))|0
}

// 状态，其中 x 是位置 (xx, xy), v是速度(vx, vy), t是帧号，event是事件字符串
function State(x, v, t, event) {
  this.x = x
  this.v = v
  this.t = t
  this.event = event
}

function StateTrajectories() {
  // id + counter 用来生成一批连续的质点号.
  this.counter = 0
  this.id = createId() << 20
  // 映射，以质点号为键，元素为 State 数组
  this.particles = {}
  // 常量，用来限制迭代查找的最大深度
  this.numIters = 25
}

var proto = StateTrajectories.prototype

// 创建质点，返回 id
proto.createParticle = function(id, x, v, t) {
  console.log("created", Date.now())
  if(!id) {
    id = this.id + (this.counter++)
  }
  this.particles[id] = [ new State(x, v, t, "create") ]
  return id
}

proto.moveParticle = function(id, x, v, t) {
  this.particles[id].push(new State(x, v, t))
}

proto.destroyParticle = function(id, x, v, t) {
  this.particles[id].push(new State(x, v, t, "destroy"))
}

function testState(a, t) {
  return a.t - t
}

// 获取 t 时刻的状态
// trajectory 是状态数组，记录某个对象的轨迹
// t 是帧号
function getState(trajectory, t) {
  // 找到数组中最后一个时间不大于 t 的元素
  var idx = bsearch.le(trajectory, t, testState)
  if(idx < 0) {
    // 都大于t的情况下，返加一个创建状态，取首个元素的(x,v,t)
    return new State(trajectory[0].x.slice(), trajectory[0].v.slice(), trajectory[0].t, "create")
  }
  if(idx === trajectory.length - 1) {
    // 都小于等于 t 的情况下
    var a = trajectory[idx]
    if("destroy" === a.event) {
      // 如果尾元素是销毁状态，返回该元素，但速度改为0，时间改为首元素的时间?
      // XXX 直接返回尾元素不好吗？
      return new State(trajectory[idx].x.slice(), [0,0], trajectory[0].t, "destroy")
    }
    // 返回外插的位置，保持最后的速度
    var dt = t - a.t
    var nx = [a.x[0] + a.v[0] * dt, a.x[1] + a.v[1] * dt]
    return new State(nx, a.v.slice(), t)
  }
  // 返回内插的位置和速度
  var a = trajectory[idx]
  var b = trajectory[idx+1]
  var dt = (t - a.t) / (b.t - a.t)
  return new State(
    hermite(a.x, a.v, b.x, b.v, dt), 
    hermite.derivative(a.x, a.v, b.x, b.v, dt),
    t)
}

// 取某个ID的质点t时刻的状态
proto.getParticle = function(id, t) {
  if(id in this.particles) {
    return getState(this.particles[id], t)
  }
  return null
}

// 按 lpf 函数(本地过滤器)取所有质点的状态
// lpf 表示距离越远，延时越大
proto.getState = function(lpf) {
  // 自身的帧号为原点的帧号
  var t0 = lpf(0, 0)
  var states = {}
  for(var id in this.particles) {
    var trajectory = this.particles[id]
    var s = getState(trajectory, t0), t
    for(var i=0; i<this.numIters; ++i) {
      // 重新声明 t 变量，该变量的值不会丢失
      // 如果距离较远，则取更早的状态
      var t = lpf(s.x[0], s.x[1])
      s = getState(trajectory, t)
      if(Math.abs(s.t - t) < 0.05) {
        break
      }
    }
    if(s.event === "create") {
      if(t < s.t) {
        continue
      }
    }
    if(s.event === "destroy") {
      if(s.t < t) {
        continue
      }
    }
    states[id] = s
  }
  return states
}

proto.listen = function(events) {
  var state = this
  events.on("create", this.createParticle.bind(this))
  events.on("move", this.moveParticle.bind(this))
  events.on("destroy", this.destroyParticle.bind(this))
}