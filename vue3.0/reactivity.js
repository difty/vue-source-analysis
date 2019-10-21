// Vue reactive
const toProxy = new WeakMap()
const toRaw = new WeakMap()
const targetMap = new WeakMap()

function isObject(obj) {
  return typeof obj === 'object' && obj !== null
}
function hasOwn(obj, key) {
  return obj.hasOwnProperty(key)
}
function reactive(obj) {
  return createReactiveObject(obj)
}
function createReactiveObject(obj) {
  // 不是对象则直接返回
  if (!isObject(obj)) {
    return obj
  }
  let observed = toProxy.get(obj)
  // 说明当前对象已经被代理过
  if (observed) return observed
  // 说明当前就是代理对象
  if (toRaw.has(obj)) return obj
  const handlers = {
    get(obj, key) {
      console.log('----------get---------')
      console.log(key)
      let result = Reflect.get(obj, key)
      track(obj, key)
      if (result._isRef) {
        return result.value
      }
      return isObject(result) ? reactive(result) : result
    },
    set(obj, key, value) {
      console.log('----------set----------')
      console.log(key, value)
      let oldValue = obj[key]
      let hasKey = hasOwn(obj, key)
      let result = Reflect.set(obj, key, value)
      if (!hasKey) {
        trigger(obj, 'add', key)
        // console.log('-----------new------------')
      } else if (oldValue !== value) {
        trigger(obj, 'set', key)
        // console.log('------------update------------')
      }
      return result
    },
    deleteProperty(obj, key) {
      // console.log('delete')
      return Reflect.deleteProperty(obj, key)
    }
  }
  let proxy = new Proxy(obj, handlers)
  toProxy.set(obj, proxy)
  toRaw.set(proxy, obj)
  return proxy
}

let activeEffectStacks = []

function track(obj, key) {
  let effect = activeEffectStacks[activeEffectStacks.length - 1]
  if (effect) {
    let depsMap = targetMap.get(obj)
    if (!depsMap) {
      targetMap.set(obj, depsMap = new Map())
    }
    let dep = depsMap.get(key)
    if (!dep) {
      depsMap.set(key, dep = new Set())
    }
    if (!dep.has(effect)) {
      dep.add(effect)
    }
  }
}

function trigger(obj, type, key) {
  let depsMap = targetMap.get(obj)
  if (!depsMap) return
  let deps = depsMap.get(key)
  if (deps) {
    deps.forEach(effect => {
      if (effect.scheduler) {
        effect.scheduler()
      } else {
        effect()
      }
    })
  }
  if (type === 'add') {
    let deps = depsMap.get('length')
    if (deps) {
      deps.forEach(effect => effect())
    }
  }
}
function effect(fn, options) {
  let effect = createReactiveEffect(fn, options)
  if (!options.lazy) {
    effect()
  }
  return effect
}

function createReactiveEffect(fn, options) {
  let effect = function() {
    return run(effect, fn)
  }
  effect.scheduler = options.scheduler
  return effect
}
function run(effect, fn) {
  try {
    activeEffectStacks.push(effect)
    fn()
  } finally {
    activeEffectStacks.pop()
  }

}

function ref(raw) {
  raw = isObject(raw) ? reactive(raw) : raw
  const v = {
    _isRef: true,
    get value() {
      track(v, 'get', '')
      return raw
    },
    set value(newValue) {
      raw = newValue
      trigger(v, 'set', 'get')
    }
  }
  return v
}

function computed(getter) {
  let dirty = true
  const runner = effect(getter, {
    lazy: true,
    scheduler: () => {
      dirty = true
    }
  })
  let value
  return {
    _isRef: true,
    get value() {
      if (dirty) {
        value = runner()
        dirty = false
      }
      return value
    }
  }
}
let a = reactive({ name: 'hello' })
console.log(a.name)
a.name = 'world'
// delete v.name

let c = reactive([1, 2, 3])
c.push(4)  // 触发两次set 则在set 里会触发两次视图更新

// let b = reactive({ name: 'hello', age: { num: 18 } })
// // 取值的时候才递归代理对象
// b.age.num = 19
// console.log(b.age.num)

// let obj = { name: 'hello' }
// let a = reactive(obj)
// let b = reactive(obj)

// let obj = { name: 'hello' }
// let obj = [1, 2, 3]
// let a = reactive(obj)
// effect(() => {
//   console.log('***' + a.length)
// })
// a.push(4)
// console.log(a)

let r = ref(1)
console.log(r.value)
effect(()=> {
  console.log('***' + r.value)
})
r.value = 2

// computed 是懒执行，不改变值不会执行
// let a = reactive({ foo: 0 })
// let c = computed(()=>{
//   console.log('执行')
//   return a.foo + 1
// })
// // 不取不执行，取n次只执行一次
// console.log(c.value)
// console.log(c.value)
