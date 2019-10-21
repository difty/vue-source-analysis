// var html = '<div id="test" class="test"><h1>{{ msg }}</h1><h2>{{ msg2 }}</h2></div>'
var html = '<div><div id="test" :data="msg3" v-show="show" class="test" v-if="show" v-for="(item, index) in [1, 2, 3]">{{ item }}<h1 @click="c">{{ msg }}</h1><h2>{{ msg2 }}</h2><h4>{{ msg4 }}</h4></div></div>'

var attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
var ncname = '[a-zA-Z_][\\w\\-\\.]*'
var qnameCapture = "((?:" + ncname + "\\:)?" + ncname + ")"

// 解析 <abc>13</abc> 成 ['<abc', 'abc']
var startTagOpen = new RegExp(("^<" + qnameCapture))

// 解析 <a b="c" d="e"> 这种时是不是到了 '>'，用在后面解析属性的时候
var startTagClose = /^\s*(\/?)>/

// 解析结尾标签
var endTag = new RegExp(("^<\\/" + qnameCapture + "[^>]*>"))

// 属性去重
function makeAttrsMap (attrs) {
  return attrs.reduce((prev, next) => {
    prev[next.name] = next.value
    return prev
  }, {})
}

function createASTElement (tag, attrs, parent) {
  return {
    type: 1,
    tag,
    attrsList: attrs,
    attrsMap: makeAttrsMap(attrs),
    parent: parent,
    children: []
  }
}

function extend (to, from) {
  return { ...to, ...from }
}

function getAndRemoveAttr (el, name, removeFromMap) {
  var val
  if ((val = el.attrsMap[name]) !== null) {
    el.attrsList = el.attrsList.filter(item => item.name !== name)
  }
  if (removeFromMap) {
    delete el.attrsMap[name]
  }
  return val
}

function processFor (el) {
  var exp
  if ((exp = getAndRemoveAttr(el, 'v-for'))) {
    var res = parseFor(exp)
    if (res) {
      extend(el, res)
    }
  }
}

function addIfCondition (el, condition) {
  if (!el.ifConditions) {
    el.ifConditions = []
  }
  el.ifConditions.push(condition)
}

// 把 if 条件添加到 el 上
function processIf (el) {
  var exp
  if ((exp = getAndRemoveAttr(el, 'v-if'))) {
    el.if = exp
    addIfCondition(el, {
      exp: exp,
      block: el
    })
  }
}

function processOnce (el) {
  var once$$1 = getAndRemoveAttr(el, 'v-once');
  if (once$$1 != null) {
    el.once = true;
  }
}

// v-for="item in [1,2]"
// v-for="(item, index) in [1,2]"
// v-for="(val, key) in {}"
// v-for="(val, key, index) in {}"
// [^] 代表所有字符，.只能匹配非 \n 的字符
var forAliasRE = /([^]*?)\s+(?:in|of)\s+([^]*)/
var stripParensRE = /^\(|\)$/g
var forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/
function parseFor (exp) {
  var inMatch = exp.match(forAliasRE)
  if (!inMatch) return
  var res = {}
  res.for = inMatch[2].trim()
  // 去掉括号
  var s = inMatch[1].trim().replace(stripParensRE, '')
  // 拆分出 val key index
  var iteratorMatch = s.match(forIteratorRE)
  if (iteratorMatch) {
    res.alias = s.replace(forIteratorRE, '')
    res.iterator1 = iteratorMatch[1].trim()
    if (iteratorMatch[2]) {
      res.iterator2 = iteratorMatch[2].trim()
    }
  } else {
    res.alias = s
  }
  return res
}

function addAttr (el, name, value) {
  (el.attrs || (el.attrs = [])).push({ name: name, value: value });
  el.plain = false;
}

var dirRE = /^v-|^@|^:/
var bindRE = /^:|^v-bind:/
var onRE = /^@|^v-on:/

function addHandler (el, name, value) {
  var events = el.events || (el.events = {})
  var newHandler = {
    value: value.trim()
  }
  var handlers = events[name]
  if (Array.isArray(handlers)) {
    handlers.push(newHandler)
  } else if (handlers) {
    events[name] = [handlers, newHandler]
  } else {
    events[name] = newHandler
  }
  el.plain = false
}

function addDirective (
  el,
  name,
  rawName,
  value,
  arg,
  modifiers
) {
  (el.directives || (el.directives = [])).push({ name: name, rawName: rawName, value: value, arg: arg, modifiers: modifiers });
  el.plain = false;
}

function processAttrs (el) {
  var list = el.attrsList;
  var i, l, name, rawName, value, modifiers, isProp;
  for (i = 0, l = list.length; i < l; i++) {
    name = rawName = list[i].name;
    value = list[i].value;
    if (dirRE.test(name)) {
      // 标记，为后面标记静态节点准备
      el.hasBindings = true
      // 数据绑定
      if (bindRE.test(name)) {
        name = name.replace(bindRE, '')
        addAttr(el, name, value)
      } else if (onRE.test(name)) {
        name = name.replace(onRE, '')
        addHandler(el, name, value)
      } else {
        name = name.replace(dirRE, '')
        addDirective(el, name, rawName, value)
      }
    } else {
      addAttr(el, name, JSON.stringify(value))
    }
  }
}

function processElement (element) {
  element.plain = !element.key && !element.attrsList.length
  processAttrs(element)
}

function parseText (text) {
  var tagRE = /\{\{((?:.|\n)+?)\}\}/g
  if (!tagRE.test(text)) return
  var tokens = []
  var rawTokens = []
  var lastIndex = tagRE.lastIndex = 0
  var match, index, tokenValue
  // 解析 text
  while((match = tagRE.exec(text))) {
    index = match.index
    // text = '123{{a}}456'时，解析前半部分
    if (index > lastIndex) {
      rawTokens.push(tokenValue = text.slice(lastIndex, index))
      tokens.push(JSON.stringify(tokenValue))
    }
    var exp = match[1]
    tokens.push(("_s(" + exp + ")"))
    rawTokens.push({ '@binding': exp })
    lastIndex = index + match[0].length
  }
  // 解析后半部分
  if (lastIndex < text.length) {
    rawTokens.push(tokenValue = text.slice(lastIndex));
    tokens.push(JSON.stringify(tokenValue));
  }
  return {
    expression: tokens.join('+'),
    tokens: rawTokens
  }
}

function parseHTML (html, options) {
  var last, index = 0, stack = [], lastTag
  while (html) {
    last = html
    // 记录 < 的初始位置
    var textEnd = html.indexOf('<')
    // 类似 '<div>' 这种
    if (textEnd === 0) {
      // 先解析 endTag 否则这种 ''</div><h1>123</h1>'.match(startTagOpen)' 返回 null 就永远无法解析下去了
      var endTagMatch = html.match(endTag)
      if (endTagMatch) {
        var curIndex  = index
        advance(endTagMatch[0].length)
        parseEndTag(endTagMatch[1], curIndex, index)
        continue
      }

      var startTagMatch = parseStartTag()
      if (startTagMatch) {
        handleStartTag(startTagMatch)
        continue
      }
    }

    var text, rest, next
    // '{{ msg }}</h1>'
    if (textEnd >= 0) {
      // rest = '</h1><h2>{{ msg2 }}</h2></div>'
      rest = html.slice(textEnd)
      // 当没有匹配到开始标签或结尾标签时
      // 这里是为了防止出现 'a < b<div></div>' 这种情况
      while (!endTag.test(rest) && !startTagOpen.test(rest)) {
        // 找下一个 '<'
        next = rest.indexOf('<', 1)
        // <div id="test" class="test"><h1>{{ msg }} a < b 出现这种情况
        // 此时 textEnd = 0 直接 break
        if (next < 0) break
        textEnd += next
        rest = html.slice(textEnd)
      }
      text = html.substring(0, textEnd)
      // 当 textEnd 为 0 的时候，html 和 之前的相比无变化
      advance(textEnd)
    }
    // 类似 '<div>abc'
    if (textEnd < 0) {
      text = html
      html = ''
    }
    if (text && options.chars) {
      options.chars(text)
    }
    // 上面说的没有结尾标签即 textEnd 始终为 0
    if (html === last) {
      console.log('标签未闭合')
      break
    }
  }

  function advance (n) {
    index += n
    html = html.substring(n)
  }

  function parseStartTag () {
    // 得到 ['<div', 'div']
    var start = html.match(startTagOpen)
    if (start) {
      // 初始化匹配对象
      var match = {
        tagName: start[1],
        attrs: [],
        start: index,
      }
      // 继续向后解析 即 ' id="test"'
      advance(start[0].length)
      var end, attr
      // 循环解析属性，直到解析到 '>'
      // [" id="test"", "id", "=", "test", undefined, undefined]
      while (!(end = html.match(startTagClose)) && (attr = html.match(attribute))) {
        advance(attr[0].length)
        match.attrs.push(attr)
      }
      // 解析到 '>' 时 [">", "", index: 0, input: ">", groups: undefined]
      // 当为 '/>' 时 ["/>", "/", index: 0, input: "/>", groups: undefined]
      if (end) {
        match.unarySlash = end[1]
        advance(end[0].length)
        match.end = index
        return match
      }
    }
  }
  function handleStartTag (match) {
    var tagName = match.tagName
    // if (lastTag === tagName) {
    //   parseEndTag(tagName)
    // }
    var l = match.attrs.length
    var attrs = new Array(l)
    for (var i = 0; i < l; i++) {
      var args = match.attrs[i]

      // 根据上面的解析属性的正则表达式得到value值
      var value = args[3] || args[4] || args[5] || ''
      attrs[i] = {
        name: args[1],
        value
      }
    }
    stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs })
    lastTag = tagName

    options.start(tagName, attrs, false, match.start, match.end)
  }
  function parseEndTag(tag, start, end) {
    var pos, lowerCasedTagName
    if (tag) {
      lowerCasedTagName = tag.toLowerCase()
    }
    // 找出 stack 里对应的项
    for (pos = stack.length - 1; pos >= 0; pos--) {
      if (stack[pos].lowerCasedTag === lowerCasedTagName) {
        break
      }
    }
    if (pos >= 0) {
      for (var i = stack.length - 1; i >= pos; i--) {
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    }
  }
}

function parse(html) {
  var stack = [], root, currentParent
  var options = {
    // unary 用于自闭合的元素，例如 input，这里先不考虑
    start: function start (tag, attrs, unary) {
      var element = createASTElement(tag, attrs, currentParent)
      // todo
      processFor(element)
      processIf(element)
      processOnce(element)
      processElement(element)

      if (!root) {
        root = element
      }
      if (currentParent) {
        currentParent.children.push(element)
        element.parent = currentParent
      }
      currentParent = element
      stack.push(element)
    },
    end: function end () {
      var element = stack[stack.length - 1]
      var lastNode = element.children[element.children.length - 1]
      // 去掉空白子节点
      if (lastNode && lastNode.type === 3 && lastNode.text === ' ') {
        element.children.pop()
      }
      // 将 stack 对应的删除
      stack.length -= 1
      currentParent = stack[stack.length - 1]
    },
    chars: function chars (text) {
      var children = currentParent.children
      if (text) {
        var res
        // 含有表达式和存文本
        if (text !== ' ' && (res = parseText(text))) {
          children.push({
            type: 2,
            expression: res.expression,
            tokens: res.tokens,
            text: text
          })
        } else if (text !== '' || !children.length) {
          children.push({
            type: 3,
            text: text
          })
        }
      }
    }
  }
  parseHTML(html, options)
  return root
}

var ast = parse(html)
// console.log(ast)

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

function genElement (ast) {
  if (el.for && !el.forProcessed) {
    return genFor(el)
  } else if (el.if && !el.ifProcessed) {
    return genIf(el)
  }
}

console.log(ast)

// module.exports = ast
