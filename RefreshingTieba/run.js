/*jshint esversion: 6 */
function inject(setting, getSpecialModules, toFastProperties) {
    'use strict';
    let {
        debugMode,
        sensitiveWordsV2,
        selector,
        bigpipeWhiteList,
        bigpipeBlackList,
        moduleWhiteList,
        moduleBlackList,
        scriptBlackList,
    } = setting;

    let scriptBlackListRule = new RegExp('(' + scriptBlackList.join(')|(') + ')');

    function createNoop() {
        return function() {};
    }
    let noop = createNoop();

    function emptyStr() {
        return '';
    }
    if (Object.freeze) {
        Object.freeze(noop);
        Object.freeze(emptyStr);
    }
    const html5AudioPlayer = {
        defaultOptions: {},
        isReady: false,
        isPlaying: false,
        isMute: false,
        volume: undefined,
        url: "",
        initial: function(options) {
            let that = this;
            this.options = $.extend(this.defaultOptions, options);
            this.audio = $('<audio autoplay="false"></audio>').get(0);
            window.pl = this;
            this.isReady = true;
            this.bindEvents();
            setTimeout(function() {
                that.trigger('playerloaded', that);
            }, 0);
        },
        onSwfLoaded: noop,
        renderSwf: emptyStr,
        bindEvents: function() {
            this.bind('reset', this._reset, this);
            this.bind('load', this._load, this);
            this.bind('play', this._play, this);
            this.bind('pause', this._pause, this);
            this.bind('stop', this._stop, this);
            this.bind('setmute', this._setMute, this);
        },
        _reset: function() {
            this._stop();
            this.audio.src = this.url = '';
            this.isPlaying = false;
        },
        _load: function(t, url, success, fail) {
            let that = this;
            this.url = url;
            if (this.failHandler) {
                clearTimeout(this.failHandler);
            }

            function listener() {
                that.audio.removeEventListener('canplaythrough', listener, false);
                that.trigger('songloaded', that._getLoadedPercent());
                that.failHandler && clearTimeout(that.failHandler);
                success && success();
            }
            this.failHandler = setTimeout(function() {
                that.audio.removeEventListener('canplaythrough', listener, false);
                if (fail) {
                    fail();
                }
            }, 5E3);
            this.audio.addEventListener('canplaythrough', listener, false);
            console.log('[清爽贴吧]播放语音: ', url);
            this.audio.src = url;
        },
        _play: function(t, updateTotal, updateTime, finish) {
            let that = this;
            if (!this.isPlaying) {
                let totalTime = this.audio.duration * 1000;
                this.audio.play();
                if (this.checkFinishedHandler) {
                    clearTimeout(this.checkFinishedHandler);
                }
                this.isPlaying = true;
                if (updateTotal) {
                    updateTotal({
                        totalTime: totalTime,
                    });
                }
                this.checkFinishedHandler = setTimeout(function getTime() {
                    let currentTime = that.audio.currentTime * 1000;
                    let percent = currentTime / totalTime;
                    updateTime && updateTime({
                        percent: percent,
                        totalTime: totalTime,
                        currentTime: currentTime,
                    });
                    if (that.audio.ended) {
                        that.trigger('playfinish', 1);
                        finish && finish();
                    } else {
                        setTimeout(getTime, 500);
                    }
                }, 1E3);
            }
        },
        _pause: function() {
            if (this.isPlaying) {
                this.audio.pause();
                this.isPlaying = false;
            }
        },
        _stop: function() {
            this.audio.pause();
            if (this.checkFinishedHandler) {
                clearTimeout(this.checkFinishedHandler);
            }
            this.isPlaying = false;
        },
        _setMute: function(t, isMute) {
            this.audio.muted = this.isMute = isMute;
        },
        _setVolume: function(t, volume) {
            this.volume = volume;
            this.audio.volume = volume / 100;
        },
        _setCurrentPosition: function() {},
        _getCurrentPosition: function() {
            return this.audio.currentTime / this.audio.duration;
        },
        _getLoadedPercent: function() {
            return this.audio.buffered.end(this.audio.buffered.length - 1) / this.audio.duration;
        },
        _getTotalTime: function() {
            return this.audio.duration * 1000;
        },
        _getCurrentTime: function() {
            return this.audio.currentTime * 1000;
        }
    };
    let specialModules = getSpecialModules(noop, emptyStr, html5AudioPlayer);
    // Logging
    let logBlocked, logPassed;
    console.info('[清爽贴吧]正在运行中' + (window.top === window ? '' : `(from iframe: ${location.href})`));

    if (debugMode) {
        let blocked = {
            script: [],
            module: [],
            bigpipe: [],
            element: [],
        }, passed = [];
        logBlocked = function(type, info) {
            blocked[type].push(info);
        };
        logPassed = function(info) {
            passed.push(info);
        };
        console.info('[清爽贴吧]过滤的模块:', blocked);
        console.info('[清爽贴吧]放行的模块:', passed);
    }
    // 劫持用
    function hijackOnce(parent, name, filter) {
        let prop = parent[name];
        if (prop) {
            let newProp = filter(prop);
            if (newProp && newProp !== prop) parent[name] = newProp;
            return;
        }
        let configurable = true,
            {
                enumerable = true,
                writable = true
            } = Object.getOwnPropertyDescriptor(parent, name) || {};
        Object.defineProperty(parent, name, {
            configurable,
            enumerable,
            get: noop,
            set(e) {
                Object.defineProperty(parent, name, {
                    configurable,
                    enumerable,
                    writable,
                    value: filter(e) || e
                });
                toFastProperties(parent);
                return true;
            }
        });
    }

    function hijack(parent, path, filter) {
        let name = path.split('.'),
            pos = 0;
        if (name.length === 1) return hijackOnce(parent, path, filter);
        (function f(node) {
            if (pos === name.length) return filter(node);
            hijackOnce(node, name[pos++], f);
        }(parent));
    }

    let sensitiveWordsRegExp = new RegExp(`(^|\\b|_)(${sensitiveWordsV2.join('|')})($|\\b|_)`, 'i');
    function hasSensitiveWords(text) {
        return sensitiveWordsRegExp.test(text.replace(/([A-Z])/g,"_$1"));
    }
    // Bigpipe
    hijack(window, 'Bigpipe', function(Bigpipe) {
        // 加载过滤
        function check(name) { // 放行返回true
            if (bigpipeBlackList.includes(name) || hasSensitiveWords(name) && !bigpipeWhiteList.includes(name)) {
                if (debugMode) logBlocked('bigpipe', name);
                return false;
            }
            return true;
        }
        let _register = Bigpipe.register;
        Bigpipe.register = function(name, info) {
            if (!check(name)) return {
                then: noop
            };
            if (info.scripts) info.scripts = info.scripts.filter(check);
            if (info.styles) info.styles = info.styles.filter(check);
            return _register.call(Bigpipe, name, info);
        };
        // 模板过滤
        Bigpipe.debug(true);
        let Pagelet = Bigpipe.Pagelet;
        Bigpipe.debug(false);
        toFastProperties(Bigpipe);
        let range = document.createRange();
        range.selectNodeContents(document.documentElement);
        Pagelet.prototype._getHTML = function() { // 略微提高性能
            let html, elem;
            if ("undefined" !== typeof this.content) { // 钦定了this.content
                html = this.content;
            } else if (elem = document.getElementById('pagelet_html_' + this.id)) { // 从模板中获取
                html = elem.firstChild.data; // 不要使用正则
                elem.remove(); // 移除模板移到这里，以免多次getElementById (review: getElementById其实是有缓存的……不知道自己当时在想什么
            } else { // 什么都没有
                return false;
            }
            return html;
        };
        let $temp, temp = document.createDocumentFragment(),
            clearId = 0,
            cleaner = function() { // 不要在当前事件cleanData
                if (!$temp) $temp = window.jQuery(temp);
                $temp.empty();
                clearId = 0;
            };

        function empty(elem) { // 用jq是为了尝试解决内存泄漏，先把内容移出，一会把内容cleanData(因为比较费时)
            let child;
            if (!elem.hasChildNodes()) return;
            if (!window.jQuery) return elem.innerHTML = '';
            while (child = elem.firstChild) temp.appendChild(child);
            if (!clearId) clearId = setTimeout(cleaner, 50);
        }
        let LOADED = 1;
        Pagelet.prototype._appendTo = function(pagelet) {
            if (!(pagelet instanceof Pagelet)) throw new TypeError(pagelet + "is not a pagelet.");
            if (this.state >= LOADED) throw new Error("pagelet[" + this.id + "] is already mounted");
            let content = this._getHTML();
            if (content !== false) {
                if (!pagelet.document) throw new Error("Cannot append pagelet[" + this.id + "] to documentless pagelet[" + pagelet.id + "]");
                let doc = this.document = this._getPlaceholder(pagelet.document);
                if (!doc) throw new Error("Cannot find the placeholder for pagelet[" + this.id + "]");
                empty(doc); // 清空doc
                if (content) {
                    let fragment = range.createContextualFragment(content),
                        list = fragment.querySelectorAll(selector), // NodeList is immutable
                        l = list.length;
                    while (l--) {
                        let elem = list[l];
                        elem.remove();
                        debugMode && logBlocked('element', elem);
                    }
                    doc.appendChild(fragment);
                }
            }
            return this
        };
    });
    // 模块过滤
    hijack(window, '_.Module', function(Module) {
        function check(module) { // 放行返回true
            if (moduleBlackList.includes(module) || hasSensitiveWords(module) && !moduleWhiteList.includes(module) || specialModules.block[module]) {
                if (debugMode) logBlocked('module', module);
                return false;
            }
            return true;
        }
        let _use = Module.use;
        Module.use = function(a, b, c, d) {
            if (!check(a)) return;
            return _use.call(Module, a, b, c, d);
        };
        let defined = new Map();
        const DEFINED_STATES = {
            PASSED: 1,
            BLOCKED: 2,
            OVERRIDED: 3,
        };
        let createInitial = debugMode ? function(path) {
            return function() {
                Object.setPrototypeOf(this, new Proxy(Object.getPrototypeOf(this), {
                    get(target, property, receiver) {
                        if (property in target) return target[property];
                        //debugger;
                        console.warn('[清爽贴吧]Undefined property:', path, property, defined.get(path), target);
                        return function() {
                            //debugger;
                        };
                    }
                }));
            };
        } : createNoop;

        function fakeDefine(path, sub_ori) {
            if (defined.has(path)) {
                if (debugMode && sub_ori && !defined.get(path)) defined.set(path, sub_ori);
                return;
            }
            let sub = {
                initial: createInitial(path), // 不用同一个initial，因为这上面会被做标记
            };
            let overrider = specialModules.block[path];
            if (overrider) Object.assign(sub, overrider);
            defined.set(path, debugMode ? sub_ori : DEFINED_STATES.BLOCKED);
            _define.call(Module, {
                path,
                sub
            });
        }

        function moduleFilter(path) {
            return check(path) || (fakeDefine(path), false);
        }
        let _define = Module.define;
        Module.define = function(info) {
            if (!check(info.path)) return fakeDefine(info.path, info.sub);
            if (info.requires) {
                if (Array.isArray(info.requires)) {
                    info.requires = info.requires.filter(moduleFilter);
                } else if ('string' === typeof info.requires) {
                    if (!check(info.requires)) {
                        fakeDefine(info.requires);
                        info.requires = undefined;
                    }
                } else {
                    console.warn('[清爽贴吧]遇到问题：未知的requires字段', info);
                }
            }
            if (specialModules.hook[info.path]) specialModules.hook[info.path](info);
            let overrider = specialModules.override[info.path];
            if (overrider) Object.assign(info.sub, overrider);
            defined.set(info.path, overrider ? DEFINED_STATES.OVERRIDED : DEFINED_STATES.PASSED);
            if (debugMode) logPassed(info.path);
            return _define.call(Module, info);
        };
    });

    function setNoop(parent, name) {
        Object.defineProperty(parent, name, {
            value: noop,
            writable: false,
            configurable: false
        });
    }
    // 广告过滤
    setNoop(window, 'BAIDU_VIDEO_FROAD_FILL');
    setNoop(window, 'BAIDU_VIDEO_FROAD_FILL_RENDERFRAME');
    // 统计过滤
    setNoop(window, 'alog');
    setNoop(window, 'passFingerload');
    hijack(window, 'PageLink', function(PageLink) {
        setNoop(PageLink, 'init');
        setNoop(PageLink, '_onclick');
    });
    // tieba.baidu.com/managerapply/apply 引入了两个 jQuery 且不用 $.noConflict() 你敢信？
    Object.defineProperty(window, 'jQuery', {
        value: window.jQuery,
        configurable: true,
        enumerable: true,
        writable: false,
    });
    hijack(window, 'jQuery', function($) {
        // 理由同上，前人挖坑后人埋
        Object.defineProperty(window, '$', {
            value: $,
            configurable: true,
            enumerable: true,
            writable: false,
        });
        hijack($, 'stats', function(stats) {
            for (let name of Object.keys(stats)) {
                setNoop(stats, name);
            }
        });
        // 允许关闭对话框
        hijack($, 'dialog', function(Dialog) {
            return class ForceCloseableDialog extends Dialog {
                constructor(config) {
                    if (config.closeable === false) {
                        config.closeable = true;
                        console.log("[清爽贴吧]已允许关闭对话框：", config);
                    }
                    super(config);
                }
            };
        });
        // wtf???  奇奇怪怪的bug处理
        {
            let offset = $.fn.offset;
            $.fn.offset = function (...args) {
                let res = offset.call(this, ...args);
                if (res) return res;
                return new Error().stack.includes('UserMessage.js') ? {left:0} : res;
            };
        }
    });
    // 免登录看帖
    hijack(window, 'PageData.user', function(user) {
        if (user.is_login) return; // 已登录
        let is_login = false; // 不能直接设置成1，因为会影响右上角显示，感谢@榕榕
        document.addEventListener('DOMContentLoaded', function() { // DOM加载完成后改成已登录状态
            is_login = 1;
        }, {
            capture: true,
            once: true,
            passive: true,
        });
        Object.defineProperty(user, 'is_login', { // 不直接改，因为会被Object.freeze()，换成getter（虽然PB页现在不freeze
            get() {
                return is_login;
            },
        });
        Object.defineProperty(user, 'no_un', {
            value: 0,
        });
    });
    // 阻止特定脚本动态加载
    let originalSrc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
    Object.defineProperty(HTMLScriptElement.prototype, 'src', {
        ...originalSrc,
        set(src) {
            if (scriptBlackListRule.test(src)) return debugMode && logBlocked('script', src), true;
            return originalSrc.set.call(this, src);
        }
    });
    hijack(EventTarget, 'prototype', function(prototype) { // 滚动速度提升
        let eventTypes = 'wheel,mousewheel,DOMMouseScroll,MozMousePixelScroll,scroll,touchstart,touchmove,touchend,touchcancel,mousemove'.split(',');
        let _add = prototype.addEventListener,
            _remove = prototype.removeEventListener;
        prototype.addEventListener = function(type, handler, capture) {
            if (!eventTypes.includes(type) || 'boolean' !== typeof capture || ![window, document, document.body].includes(this) || new Error().stack.includes('eval')) return _add.call(this, type, handler, capture);
            if ('mousemove' === type) return; // 监听这个的都是分享、XSS监控这种鸡肋玩意
            return _add.call(this, type, handler, {
                capture,
                passive: true
            });
        }
        prototype.removeEventListener = function(type, handler, capture) {
            if (!eventTypes.includes(type) || 'boolean' !== typeof capture) return _remove.call(this, type, handler, capture);
            return _remove.call(this, type, handler, {
                capture,
                passive: true
            });
        }
    });
}
let toFastProperties = `function toFastProperties(obj) {
    /*jshint -W027,-W055,-W031*/
    function FakeConstructor() {}
    FakeConstructor.prototype = obj;
    let receiver = new FakeConstructor();
    function ic() {
        return typeof receiver.foo;
    }
    ic();
    ic();
    // ASSERT("%HasFastProperties", true, obj);
    return obj;
    // Prevent the function from being optimized through dead code elimination
    // or further optimizations. This code is never reached but even using eval
    // in unreachable code causes v8 to not optimize functions.
    eval(obj);
}`; // from bluebird, use string to avoid 'eval'
(function() {
    'use strict';
    let s = document.createElement('script');
    s.textContent = `(${inject}(${JSON.stringify(setting)},${getSpecialModules},${toFastProperties}))`;
    document.documentElement.appendChild(s);
    s.remove();
}());
(function() { // 特殊广告处理
    'use strict';
    document.addEventListener("animationstart", function(event) {
        let target = event.target;
        switch (event.animationName) {
            case 'ads_need_remove':
                target.remove();
                break;
            case 'ps_cb_ad':
                target.replaceWith(target.firstChild);
                break;
            case 'colorful_idiots':
                target.classList.remove('post_props_colorful');
                target.classList.remove('post_props_1040001');
                let txt = String.fromCharCode(...[].map.call(target.querySelectorAll('.BDE_Colorful'), elem => elem.getAttribute('code')));
                target.innerHTML = '';
                target.appendChild(document.createTextNode(txt));
                break;
            case 'ad_bottom_view':
                let post = target.closest('.l_post');
                post && post.remove();
                break;
        }
    }, false);
}());
