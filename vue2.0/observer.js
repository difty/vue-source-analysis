function defineReactive(data, key, val) {
  let dep = new Dep()
  observe(val)
  Object.defineProperty(data, key, {
    configurable: true,
    enumerable: true,
    get: function() {
      console.log('invoke getter:' + val)
      dep.depend()
      return val
    },
    set: function(newVal) {
      if (newVal === val) return
      console.log('invoke setter:' + newVal)
      dep.notify()
      val = newVal
    },
  })
}

function Dep() {
  this.subs = []
}

Dep.prototype.depend = function () {
  if (Dep.target) {
    this.subs.push(Dep.target)
  }
}

Dep.prototype.notify = function () {
  // 先备份，避免 subs 改变
  const subs = this.subs.slice()
  subs.forEach(sub => {
    sub.update()
  })
}

function Watcher(vm, exp, cb) {
  this.vm = vm
  this.exp = exp
  this.cb = cb
  this.value = this.get()
}

Watcher.prototype.update = function() {
  let oldVal  = this.value
  let newVal = this.get()
  if (oldVal !== newVal) {
    this.value = newVal
    this.cb.call(this.vm, newVal, oldVal)
  }
}

Watcher.prototype.get = function () {
  Dep.target = this
  let value = this.vm[this.exp]
  Dep.target = null
  return value
}

const arrayProto = Array.prototype
const arrayMethods = Object.create(arrayProto)

;['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse']
.forEach(method => {
  Object.defineProperty(arrayMethods, method, {
    value: function(...args) {
      console.log(method)
      const ob = this.__ob__
      const result =  arrayProto[method].apply(this, args)
      let insert
      switch(method) {
        case 'push':
        case 'unshift':
          insert = args
          break
        case 'splice':
          insert = args.slice(2)
          break
      }
      if (insert) {
        ob.observeArray(insert)
      }
      ob.dep.notify()
      return result
    }
  })
})

function def (obj, key, val, enumerable) {
  Object.defineProperty(obj, key, {
    value: val,
    enumerable: !!enumerable,
    writable: true,
    configurable: true
  })
}

function Observer(value) {
  this.value = value
  this.dep = new Dep()
  def(value, '__ob__', this)
  if (Array.isArray(value)) {
    value.__proto__ = arrayMethods
    this.observeArray(value)
  } else {
    this.walk(value)
  }
}

Observer.prototype.walk = function(obj) {
  if (!obj || typeof obj !== 'object') return
  Object.keys(obj).forEach(key => {
    defineReactive(obj, key, obj[key])
  })
}

Observer.prototype.observeArray = function(val) {
  val.forEach(item => {
    observe(item)
  })
}

function observe(obj) {
  if (isPlainObject(obj) || Array.isArray(obj)) {
    return new Observer(obj)
  }
}

function isPlainObject(obj) {
  return Object.prototype.toString.call(obj) === '[object Object]'
}

let obj = { a: 1, b: { c: 2 } }
let arr  = [1, 2, 3]
let arr1  = [{a: 1}, {b: 2}]
observe(obj)
observe(arr)
observe(arr1)
