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

