"use strict"

module.exports = drawState

var hashInt = require("hash-int")
var pad = require("pad")

// 渲染状态
// context 是画布，client 是客户端对象或服务器对象，保存了状态
// lpf 是个函数 function(x, y) 返回帧号。
function drawState(context, client, lpf) {
  // 获取状态，每个状态是 id -> (x, y) 映射，在 (x, y) 处画个圆
  var particles = client.state.getState(lpf)
  context.fillStyle = "#000000"
  context.fillRect(-10, -10, 20, 20)
  for(var id in particles) {
    var color = (hashInt(id|0)>>>0) & 0xffffff
    var p = particles[id]
    context.fillStyle = "#" + pad(6, color.toString(16), "0")
    context.beginPath()
    context.arc(p.x[0], p.x[1], 0.5, 0, Math.PI * 2, true)
    context.closePath()
    context.fill()
  }
}