local-perception-filter-demo
============================

本地感知过滤器

演示: http://jinq0123.github.io/local-perception-filter-demo/

Jinq fork: 添加中文代码注释

A simple demo exploring the concept of local perception filters a means to hide latency in distributed multiplayer videogames.

## 本地测试

1. 安装 node.js
1. npm install
1. npm start

将自动打开本地网页运行。

## 打包 bundle.js

在 gh-pages 分支上打包 bundle.js，用来发布到 github 。

.\node_modules\.bin\browserify.cmd .\index.js -d -o .\bundle.js

## 过滤选项说明

本演示的亮点是用一个 lpf() 过滤函数统一了 3 种同步方式：

* Strict: Wait until all inputs collected before drawing
* Optimistic: Draw as soon as local input pressed
* Local perception filter: Warp time depending on distance to remote player

说明:

* Strict: 渲染过去的状态, lpf() 返回过去的时间
* Optimistic: 渲染当前的状态，lpf() 返回当前时间
* Local perception filter: 自身渲染当前的状态，其他玩家渲染过去的状态，lpf() 按距离返回插值时间

`drawState(context, client, lpf)`中和`lpf`是过滤函数，如：
```js
function(x, y) {
    return server.tickCount
}
```

## 其他说明

* 客户端服务器使用同一个时钟。
* 客户端动作的时戳使用了本地时戳，而不是服务器收到后才动作。
* 服务器渲染当前帧时，客户端数据还未收到，所以总是取外插数据。
* 服务器渲染总是使用 server.tickCount 整数值为时间，所以是一跳一跳的。
  而客户端渲染使用 local.localTick() 浮点数时间，所以是平滑的。
  
  