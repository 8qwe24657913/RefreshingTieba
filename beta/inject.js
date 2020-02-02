'use strict'
/* exported inject */
function inject(
    setting,
    getSpecialModules,
    html5AudioPlayer,
    initGeeTestService,
    toFastProperties,
) {
    'use strict'
    const {
        debugMode,
        sensitiveWordsV2,
        selector,
        bigpipeWhiteList,
        bigpipeBlackList,
        moduleWhiteList,
        moduleBlackList,
        scriptBlackList,
    } = setting

    const scriptBlackListRule = new RegExp('(' + scriptBlackList.join(')|(') + ')')

    function createNoop() {
        return function() {}
    }
    const noop = createNoop()

    function emptyStr() {
        return ''
    }
    Object.freeze(noop)
    Object.freeze(emptyStr)

    html5AudioPlayer = html5AudioPlayer(noop, emptyStr)
    initGeeTestService = initGeeTestService(noop, emptyStr)
    const specialModules = getSpecialModules(noop, emptyStr, html5AudioPlayer, initGeeTestService)
    // Logging
    let logBlocked, logPassed
    if (!debugMode) {
        console.info(
            '[清爽贴吧]正在运行中' + (window.top === window ? '' : `(from iframe: ${location.href})`),
        )
    } else {
        const blocked = {
            script: [],
            module: [],
            bigpipe: [],
            element: [],
        }
        const passed = []
        logBlocked = function(type, info) {
            blocked[type].push(info)
        }
        logPassed = function(info) {
            passed.push(info)
        }
        console.group(
            '[清爽贴吧]正在运行中' + (window.top === window ? '' : `(from iframe: ${location.href})`),
        )
        console.log('过滤的模块:')
        console.dir(blocked)
        console.log('放行的模块:')
        console.dir(passed)
        console.groupEnd()
    }
    // 劫持用
    function hijackOnce(parent, name, filter, desc) {
        const prop = parent[name]
        if (prop) {
            const newProp = filter(prop)
            if (newProp && newProp !== prop) parent[name] = newProp
            return
        }
        const { enumerable = true, writable = true } = Object.assign(
            Object.getOwnPropertyDescriptor(parent, name) || {},
            desc,
        )
        Object.defineProperty(parent, name, {
            configurable: true,
            enumerable,
            get: noop,
            set(e) {
                Object.defineProperty(parent, name, {
                    configurable: true,
                    enumerable,
                    writable,
                    value: filter(e) || e,
                })
                toFastProperties(parent)
                return true
            },
        })
    }

    function hijack(parent, path, filter, desc) {
        const name = path.split('.')
        let pos = 0
        if (name.length === 1) return hijackOnce(parent, path, filter, desc)
        ;(function f(node) {
            if (pos === name.length) return filter(node)
            hijackOnce(node, name[pos++], f)
        })(parent)
    }

    const sensitiveWordsRegExp = new RegExp(`(^|\\b|_)(${sensitiveWordsV2.join('|')})($|\\b|_)`, 'i')

    function hasSensitiveWords(text) {
        return sensitiveWordsRegExp.test(text.replace(/([A-Z])/g, '_$1'))
    }
    // Bigpipe
    hijack(window, 'Bigpipe', Bigpipe => {
    // 加载过滤
        function check(name, usage) {
            // 放行返回true
            if (
                bigpipeBlackList.includes(name) ||
        (hasSensitiveWords(name) && !bigpipeWhiteList.includes(name))
            ) {
                if (debugMode) logBlocked('bigpipe', usage + ' ' + name)
                return false
            }
            return true
        }
        hijack(
            Bigpipe,
            'register',
            register =>
                function(name, info) {
                    if (!check(name, 'register')) {
                        return {
                            then: noop,
                        }
                    }
                    if (Array.isArray(info.scripts)) {
                        info.scripts = info.scripts.filter(x => check(x, 'dependency'))
                    }
                    if (Array.isArray(info.styles)) {
                        info.styles = info.styles.filter(x => check(x, 'dependency'))
                    }
                    return register.call(Bigpipe, name, info)
                },
        )
        // 模板过滤
        Bigpipe.debug(true)
        const Pagelet = Bigpipe.Pagelet
        Bigpipe.debug(false)
        toFastProperties(Bigpipe)
        Pagelet.prototype._getHTML = function() {
            // 略微提高性能
            let html, elem
            if (this.content !== undefined) {
                // 钦定了this.content
                html = this.content
            } else {
                elem = document.getElementById('pagelet_html_' + this.id)
                if (elem) {
                    // 从模板中获取
                    html = elem.firstChild.data // 不要使用正则
                    elem.remove() // 移除模板移到这里，以免多次getElementById (review: getElementById其实是有缓存的……不知道自己当时在想什么
                } else {
                    // 什么都没有
                    return false
                }
            }
            return html
        }
        let $clearElem
        let clearId = 0
        const clearElem = document.createElement('template')
        const cleaner = function() {
            // 不要在当前事件cleanData
            if (!$clearElem) $clearElem = window.jQuery(clearElem)
            $clearElem.empty()
            clearId = 0
        }

        function empty(elem) {
            // 用jq是为了尝试解决内存泄漏，先把内容移出，一会把内容cleanData(因为比较费时)
            if (!elem.hasChildNodes()) return
            if (!window.jQuery) {
                elem.innerHTML = '' // 还没引入 jq 自然就没有 jq 导致的内存泄漏
                return
            }
            const range = document.createRange()
            range.selectNodeContents(elem)
            const contents = range.extractContents()
            clearElem.appendChild(contents)
            if (clearId) clearTimeout(clearId)
            clearId = setTimeout(cleaner, 50)
        }
        const template = document.createElement('template')
        Pagelet.prototype._appendTo = function(pagelet) {
            if (!(pagelet instanceof Pagelet)) throw new TypeError(pagelet + 'is not a pagelet.')
            const LOADED = 1
            if (this.state >= LOADED) throw new Error('pagelet[' + this.id + '] is already mounted')
            const content = this._getHTML()
            if (content !== false) {
                if (!pagelet.document) {
                    throw new Error(
                        'Cannot append pagelet[' + this.id + '] to documentless pagelet[' + pagelet.id + ']',
                    )
                }
                const doc = (this.document = this._getPlaceholder(pagelet.document))
                if (!doc) throw new Error('Cannot find the placeholder for pagelet[' + this.id + ']')
                empty(doc) // 清空doc
                if (content) {
                    template.innerHTML = content // fix: range.createContextualFragment() will load the resources unexpectedly
                    const fragment = template.content
                    // fliter elements
                    const elemsToRemove = fragment.querySelectorAll(selector) // NodeList from querySelectorAll() is immutable
                    for (const elem of elemsToRemove) {
                        elem.remove()
                    }
                    if (debugMode) {
                        for (const elem of elemsToRemove) {
                            logBlocked('element', elem)
                        }
                    }
                    const scripts = fragment.querySelectorAll('script') // NodeList from querySelectorAll() is immutable
                    doc.appendChild(fragment)
                    for (const script of scripts) {
                        // imperfect fix: <script> doesn't work
                        const replacement = document.createElement('script')
                        for (const attr of script.attributes) {
                            replacement.attributes.setNamedItem(attr.cloneNode())
                        }
                        if (script.firstChild) replacement.appendChild(script.firstChild)
                        script.replaceWith(replacement)
                    }
                }
            }
            return this
        }
    })
    // 模块过滤
    hijack(window, '_.Module', Module => {
        window.F.module(
            'common/widget/paypost_data',
            (n, t) => {
                const e = {}
                let o = null
                const U = function() {}
                U.prototype = {
                    set(n, t) {
                        e[n] = t
                        return true
                    },
                    get(n) {
                        return e[n] ? e[n] : null
                    },
                }
                U.getInstance = function() {
                    if (!o) o = new U()
                    return o
                }
                t.getInstance = U.getInstance
            },
            [],
        )
        let /* _require, */ _requireInstance
        /*
        function FFilter(path) {
            return check(path, 'F') || (F.module(path, specialModules.F[path] || function(...args){console.log(path,this,...args);return class{}}, []), false);
        }
        const require = function(path) {
            FFilter(path);
            return _require.call(this, path);
        };
        require.async = function (path, callback) {
            if (typeof path === 'string') path = [path];
            path.forEach(FFilter);
            return _require.async.call(this, path, callback);
        }
        */
        const requireInstance = function(path, params) {
            moduleFilter(path, 'requireInstance')
            return _requireInstance.call(this, path, params)
        }
        // get requireInstance() by some black magic
        Module.define({
            path: 'common/widget/RefreshingTieba',
            sub: {
                initial() {
                    // _require = this.require;
                    _requireInstance = this.requireInstance
                },
            },
        })
        Module.use('common/widget/RefreshingTieba')
        /*
        hijack(window.F, 'module', module => {
            const defined = new Set();
            const fakeFn = Object.freeze(() => noop);
            function fakeDefine(path) {
                return module.call(F, path, fakeFn, []);
            }
            hijack(window.F, 'require', require => {
                return function(path, ...args) {
                    if (!defined.has(path)) fakeDefine(path);
                    return require.call(this, path, ...args);
                };
            });
            return function (path, fn, arr) {
                defined.add(path);
                let wrappedFn;
                if (hasSensitiveWords(String(path))) wrappedFn = fakeFn;
                else wrappedFn = function (require, wtf) {
                    return fn.call(this, F.require, wtf);
                };
                return module.call(F, path, wrappedFn, arr);
            };
        });
        */

        function check(module, usage) {
            // 放行返回true
            if (
                moduleBlackList.includes(module) ||
        (hasSensitiveWords(module) && !moduleWhiteList.includes(module)) ||
        specialModules.block[module]
            ) {
                if (debugMode) logBlocked('module', usage + ' ' + module)
                return false
            }
            return true
        }
        hijack(
            Module,
            'use',
            use =>
                function(a, b, c, d) {
                    if (!check(a, 'use')) return
                    return use.call(Module, a, b, c, d)
                },
        )
        const defined = new Map()
        const DEFINED_STATES = {
            PASSED: 1,
            BLOCKED: 2,
            OVERRIDED: 3,
        }
        const createInitial = debugMode
            ? function(path) {
                return function() {
                    Object.setPrototypeOf(
                        this,
                        new Proxy(Object.getPrototypeOf(this), {
                            get(target, property, _receiver) {
                                if (property in target) return target[property]
                                // DebuggerStatement affects performance though it's not executed
                                // debugger;
                                console.warn(
                                    '[清爽贴吧]Undefined property:',
                                    path,
                                    property,
                                    defined.get(path),
                                    target,
                                )
                                return function() {
                                    // debugger;
                                }
                            },
                        }),
                    )
                }
            }
            : createNoop

        const _define = Module.define

        function fakeDefine(path, subOri) {
            if (defined.has(path)) {
                if (debugMode && subOri && !defined.get(path)) defined.set(path, subOri)
                return
            }
            const sub = {
                initial: createInitial(path), // 不用同一个initial，因为这上面会被做标记
            }
            const overrider = specialModules.block[path]
            if (overrider) Object.assign(sub, overrider)
            defined.set(path, debugMode ? subOri : DEFINED_STATES.BLOCKED)
            _define.call(Module, {
                path,
                sub,
            })
        }

        function moduleFilter(path, usage) {
            return check(path, usage) || (fakeDefine(path), false)
        }
        Module.define = function(info) {
            if (!check(info.path, 'define')) return fakeDefine(info.path, info.sub)
            if (info.requires) {
                if (Array.isArray(info.requires)) {
                    info.requires = info.requires.filter(x => moduleFilter(x, 'dependency'))
                } else if (typeof info.requires === 'string') {
                    if (!check(info.requires, 'dependency')) {
                        fakeDefine(info.requires)
                        info.requires = undefined
                    }
                } else {
                    console.warn('[清爽贴吧]遇到问题：未知的requires字段', info)
                }
            }
            if (info.sub.initGeeTestService) info.sub.initGeeTestService = initGeeTestService // PostService 和 SimplePoster 有点多，先临时补一下
            if (info.extend) moduleFilter(info.extend, 'extend')
            if (specialModules.hook[info.path]) specialModules.hook[info.path](info)
            const overrider = specialModules.override[info.path]
            if (overrider) Object.assign(info.sub, overrider)
            /*
            const initial = info.sub.initial;
            info.sub.initial = function (...args) {
                this.require = require;
                if (typeof initial === 'function') return initial.call(this, ...args);
            };
            */
            if (!info.sub.requireInstance) info.sub.requireInstance = requireInstance
            defined.set(info.path, overrider ? DEFINED_STATES.OVERRIDED : DEFINED_STATES.PASSED)
            if (debugMode) logPassed('define ' + info.path)
            return _define.call(Module, info)
        }
    })

    function fixProp(parent, name, value) {
        Object.defineProperty(parent, name, {
            value,
            configurable: true,
            enumerable: true,
            writable: false,
        })
    }

    function setNoop(parent, name) {
        fixProp(parent, name, noop)
    }
    fixProp(window, 'bdRes2Exe', Object.freeze({}))
    // 广告过滤
    setNoop(window, 'BAIDU_VIDEO_FROAD_FILL')
    setNoop(window, 'BAIDU_VIDEO_FROAD_FILL_RENDERFRAME')
    // 统计过滤
    setNoop(window, 'alog')
    setNoop(window, 'passFingerload')
    setNoop(window, 'ad_manager_loadPic')
    hijack(window, 'PageLink', PageLink => {
        setNoop(PageLink, 'init')
        setNoop(PageLink, '_onclick')
    })
    fixProp(
        window,
        'bdShareTb',
        Object.freeze({
            fn: Object.freeze({
                init: noop,
            }),
        }),
    )
    hijack(
        window,
        'jQuery',
        $ => {
            // 写死一些统计函数，即使过滤掉 tb_stats_xxxxx.js 也能正常工作
            fixProp($, 'stats', {})
            window.Stats = window.Statistics = $.stats
            for (const name of [
                'hive',
                'processTag',
                'redirect',
                'scanPage',
                'sendRequest',
                'track',
                '_warn',
            ]) {
                $.stats[name] = noop
            }
            Object.freeze($.stats)
            window.FP_ARG = window.FP_ARG || {
                page: 'frs',
                source: 'profile',
                tpl: 'tieba',
            }
            hijack($, 'tb', tb => {
                fixProp(tb, 'Stats', {})
                for (const name of ['bind', 'unbind', 'sendRequest']) {
                    tb.Stats[name] = noop
                }
                tb.Stats.getPath = emptyStr
                Object.freeze(tb.Stats)
            })
            // 允许关闭对话框
            hijack(
                $,
                'dialog',
                Dialog =>
                    class ForceCloseableDialog extends Dialog {
                        constructor(config) {
                            if (config.closeable === false) {
                                config.closeable = true
                                console.log('[清爽贴吧]已允许关闭对话框：', config)
                            }
                            super(config)
                        }
                    },
            )
            // wtf???  奇奇怪怪的bug处理
            hijack(
                $.fn,
                'offset',
                offset =>
                    function(...args) {
                        const res = offset.call(this, ...args)
                        if (res) return res
                        const stack = new Error().stack
                        if (stack.includes('UserMessage.js') || stack.includes('post_list')) {
                            return {
                                top: 0,
                                left: 0,
                            }
                        }
                        return res
                    },
            )
            // tieba.baidu.com/managerapply/apply 引入了两个 jQuery 且不用 $.noConflict() 你敢信？
            fixProp(window, '$', $)
        },
        {
            writable: false, // 理由同上，前人挖坑后人填
        },
    )
    hijack(window, 'PageData', PageData => {
    // 免登录看帖
        hijack(PageData, 'user', user => {
            if (user.is_login) return // 已登录
            let isLogin = false // 不能直接设置成1，因为会影响右上角显示，感谢@榕榕
            document.addEventListener(
                'DOMContentLoaded',
                () => {
                    // DOM加载完成后改成已登录状态
                    isLogin = 1
                },
                {
                    capture: true,
                    once: true,
                    passive: true,
                },
            )
            Object.defineProperty(user, 'is_login', {
                // 不直接改，因为会被Object.freeze()，换成getter（虽然PB页现在不freeze
                get() {
                    return isLogin
                },
            })
            fixProp(user, 'no_un', 0)
        })
        hijack(PageData, 'thread.is_ad', () => 0)
    })
    // auto link
    hijack(
        window,
        'UE.plugins.autolink',
        () =>
            function() {
                this.addOutputRule(parent => {
                    window.$.each(parent.getNodesByTagName('a'), (t, link) => {
                        const r = link.innerText()
                        if (!/^\w+:\/\//.test(r)) link.setAttr('href', 'http://' + r)
                        link.setAttr('target', '_blank')
                    })
                    const textNodes = []
                    parent.traversal(node => {
                        node.type === 'text' && node.parentNode.tagName !== 'a' && textNodes.push(node)
                    })
                    for (const textNode of textNodes) {
                        const content = textNode
                            .getData()
                            .replace(/&#39;/g, "'")
                            .replace(/&quot;/g, '"')
                        const arr = content.split(
                            /(?:^|\b)((?:https?|mms|rtsp|ftp):\/\/[0-9a-zA-Z;.!~#?:/&%\-+*=@_$]+)(?:$|\b)/gi,
                        )
                        if (arr.length <= 1) continue
                        const parentNode = textNode.parentNode
                        for (const [index, text] of arr.entries()) {
                            let newNode
                            if (index % 2 === 0) {
                                if (!text) continue
                                newNode = window.UE.uNode.createText(text)
                            } else {
                                newNode = window.UE.uNode.createElement('a')
                                newNode.setAttr('href', /^\w+:\/\//.test(text) ? text : 'http://' + text)
                                newNode.setAttr('target', '_blank')
                                newNode.innerText(text)
                            }
                            parentNode.insertBefore(newNode, textNode)
                        }
                        parentNode.removeChild(textNode)
                    }
                }, true)
            },
    )
    // 阻止特定脚本动态加载
    const originalSrc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src')
    // eslint-disable-next-line accessor-pairs
    Object.defineProperty(HTMLScriptElement.prototype, 'src', {
        ...originalSrc,
        set(src) {
            if (scriptBlackListRule.test(src)) {
                if (debugMode) {
                    logBlocked('script', src)
                }
                return true
            }
            return originalSrc.set.call(this, src)
        },
    })
    HTMLScriptElement.prototype.setAttribute = function(key, val) {
        if (key === 'src' && scriptBlackListRule.test(val)) {
            if (debugMode) {
                logBlocked('script', val)
            }
            return
        }
        return Element.prototype.setAttribute.call(this, key, val)
    }
    hijack(EventTarget, 'prototype', prototype => {
    // 滚动速度提升
        const eventTypes = new Set(
            'wheel,mousewheel,DOMMouseScroll,MozMousePixelScroll,scroll,touchstart,touchmove,touchend,touchcancel,mousemove'.split(
                ',',
            ),
        )
        hijack(
            prototype,
            'addEventListener',
            _add =>
                function(type, handler, capture) {
                    if (
                        !eventTypes.has(type) || // 不需要强制 passive 的事件类型
            typeof capture !== 'boolean' || // 已经规定了是否 passive
            new Error().stack.includes('eval') // 防止与 userscript 冲突
                    ) {
                        return _add.call(this, type, handler, capture)
                    }
                    if (type === 'mousemove') return // 监听这个的都是分享、XSS监控这种鸡肋玩意
                    return _add.call(this, type, handler, {
                        capture,
                        passive: true,
                    })
                },
        )
        hijack(
            prototype,
            'removeEventListener',
            remove =>
                function(type, handler, capture) {
                    if (!eventTypes.has(type) || typeof capture !== 'boolean') {
                        return remove.call(this, type, handler, capture)
                    }
                    return remove.call(this, type, handler, {
                        capture,
                        passive: true,
                    })
                },
        )
    })
}
