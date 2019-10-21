const ast = require('./parseHTML')

function optimize (node) {
  markStatic(node)
  markStaticRoot(node)
}

function markStatic (node) {
  node.static = node.type === 3
  if (node.type === 1) {
    node.static = true
    for (var i = 0; i < node.children.length; i++) {
      var child = node.children[i]
      markStatic(child)
      if (!child.static) {
        node.static = false
      }
    }
  }
}

function markStaticRoot (node) {
  if (node.type === 1) {
    if (node.children.length && node.static) {
      node.staticRoot = true
    } else {
      node.staticRoot = false
    }
    if (node.children) {
      for (var i = 0; i < node.children.length; i++) {
        markStaticRoot(node.children[i])
      }
    }
  }
}
optimize(ast)
console.log(ast)
