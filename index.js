"use strict"

// game-shell 是一个游戏框架，https://github.com/mikolalysenko/game-shell
var createShell = require("game-shell")
var createServer = require("./lib/server")
var renderState = require("./lib/render-state")

// 游戏帧间隔时间 (ms/tick)
var tickStep = 50
var moveSpeed = 0.25
var shootSpeed = 1.0

var shell = createShell({ 
  element: "gameContainer",
  tickStep: tickStep 
})

// 一个服务器对象，2个客户端对象，各自带画布
var server = createServer(tickStep)
var players = [null, null]
var serverCanvas = null
var playerCanvases = [null, null]

/* Latency filter 延迟过滤:
    Strict:                  Wait until all inputs collected before drawing
    Optimistic:              Draw as soon as local input pressed
    Local perception filter: Warp time depending on distance to remote player
*/
var latencyFilter = ["Strict", "Strict"]

var useGL = true

//Bind keys
shell.bind("left-1", "A")
shell.bind("right-1", "D")
shell.bind("up-1", "W")
shell.bind("down-1", "S")
shell.bind("shoot-1", "Q")

shell.bind("left-2", "left")
shell.bind("right-2", "right")
shell.bind("up-2", "up")
shell.bind("down-2", "down")
shell.bind("shoot-2", "space")

function makeCanvas(element) {
  var canvas = document.getElementById(element)
  var ctx = canvas.getContext("2d")
  ctx.translate(canvas.width/2, canvas.height/2)
  ctx.scale(canvas.width/20, canvas.height/20)
  return ctx
}

// 设置延时，变化时重新设置
function addLagListener(lagElement, player) {
  player.setLag(0.5*lagElement.value|0)
  lagElement.addEventListener("change", function() {
    player.setLag(0.5*lagElement.value|0)
  })
}

// 设置过滤，变化时重新设置
function addFilterListener(filterElement, player) {
  function updateFilter() {
    latencyFilter[player] = filterElement.value
  }
  filterElement.addEventListener("change", updateFilter)
  updateFilter()
}

// 初始化
shell.on("init", function() {
  shell.element.tabindex = 1
  players = [
    server.createClient(100, [-1, 0]),
    server.createClient(100, [ 1, 0])
  ]
  players[0].lastVelocity = [ 1, 0]
  players[1].lastVelocity = [-1, 0]

  //Fix up input stuff
  document.body.style.overflow = ""
  document.body.style.height = ""

  //Create canvases for players and server
  serverCanvas = makeCanvas("serverCanvas")
  
  //Attach listeners for players
  for(var i=0; i<2; ++i) {
    var playerStr = "player" + (i+1)
    playerCanvases[i] = makeCanvas(playerStr + "Canvas")
    var lagTime = document.getElementById(playerStr + "Lag")
    addLagListener(lagTime, players[i])
    var latencyFilter = document.getElementById(playerStr + "Filter")
    addFilterListener(latencyFilter, i)
  }

  var moveInput = document.getElementById("moveSpeed")
  moveInput.addEventListener("change", function() {
    moveSpeed = +moveInput.value
  })
  moveSpeed = +moveInput.value

  var shootInput = document.getElementById("particleSpeed")
  shootInput.addEventListener("change", function() {
    shootSpeed = +shootInput.value
  })
  shootSpeed = +shootInput.value

  var tickInput = document.getElementById("tickStep")
  tickInput.addEventListener("change", function() {
    server.setTickStep(tickInput.value|0)
    tickStep = tickInput.value|0
  })
  server.setTickStep(tickInput.value|0)
  tickStep = tickInput.value|0
})

//Handle inputs
shell.on("tick", function() {
  for(var i=1; i<=2; ++i) {
    var v = [0,0]
    if(shell.wasDown("left-" + i)) {
      v[0] -= 1
    }
    if(shell.wasDown("right-" + i)) {
      v[0] += 1
    }
    if(shell.wasDown("up-" + i)) {
      v[1] -= 1
    }
    if(shell.wasDown("down-" + i)) {
      v[1] += 1
    }
    var vm = v[0] * v[0] + v[1] * v[1]
    if(vm > 1e-6) {
      v[0] *= moveSpeed / Math.sqrt(vm)
      v[1] *= moveSpeed / Math.sqrt(vm)
    }
    // 设置玩家速度(x,y), 只有8个方向的速度. 并触发每帧移动事件。
    players[i-1].setVelocity(v)
    if(shell.press("shoot-" + i)) {
      players[i-1].shoot(shootSpeed)
    }
  }
})

//Render state
// 渲染状态
shell.on("render", function(dt) {
  // 服务器总是用固定的 lpf 函数获取状态并渲染, 按服务器时间取状态
  renderState(serverCanvas, server, function(x, y) {
    return server.tickCount
  })
  // 2个玩家的渲染
  for(var i=0; i<2; ++i) {
    // 当前玩家(local)和另一玩家(remote)
    var local = players[i]
    var remote = players[i^1]
    // 本地帧号和远端帧号，远端帧号总是滞后本地帧号，滞后量为对方的Ping值
    // XXX 为什么滞后量为对方的Ping值，不是对方加本方?
    var tl = local.localTick()
    var tr = tl - 2.0 * remote.lag / tickStep
    // 不同的延迟过滤器，取不同的 lpf 函数
    if(latencyFilter[i] === "Strict") {
      // Strict 模式下按远端时间取状态
      renderState(playerCanvases[i], players[i], function(x, y) {
        return tr
      })
    } else {
      var remoteP = local.state.getParticle(remote.character, tr)
      if(latencyFilter[i] !== "Optimistic" && remoteP) {
        // 按本地感知过滤器方式取状态
        var remoteX = remoteP.x
        var localX = local.state.getParticle(local.character, tl).x
        // XXX 为什么乘 2 ?
        var c = 2 * Math.max(shootSpeed, moveSpeed)
        renderState(playerCanvases[i], players[i], function(x, y) {
          var dx = x - remoteX[0]
          var dy = y - remoteX[1]
          var d = Math.sqrt(dx * dx + dy * dy) / c
          // 远端玩家处时间为 tr+, 本地玩家处时间为 tl
          return Math.min(tr + d - 1, tl)
        })
      } else {
        // Optimistic 模式下按本地时间取状态
        renderState(playerCanvases[i], players[i], function(x, y) {
          return tl
        })
      }
    }
  }
})