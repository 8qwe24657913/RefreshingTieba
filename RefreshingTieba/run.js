'use strict';

function inject(setting, getSpecialModules, toFastProperties) {
    'use strict';
    const {
        debugMode,
        sensitiveWordsV2,
        selector,
        bigpipeWhiteList,
        bigpipeBlackList,
        moduleWhiteList,
        moduleBlackList,
        scriptBlackList,
    } = setting;

    const scriptBlackListRule = new RegExp('(' + scriptBlackList.join(')|(') + ')');

    function createNoop() {
        return function() {};
    }
    const noop = createNoop();

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
        url: '',
        initial(options) {
            const that = this;
            this.options = $.extend(this.defaultOptions, options);
            this.audio = $('<audio autoplay="false"></audio>').get(0);
            window.pl = this;
            this.isReady = true;
            this.bindEvents();
            setTimeout(() => {
                that.trigger('playerloaded', that);
            }, 0);
        },
        onSwfLoaded: noop,
        renderSwf: emptyStr,
        bindEvents() {
            this.bind('reset', this._reset, this);
            this.bind('load', this._load, this);
            this.bind('play', this._play, this);
            this.bind('pause', this._pause, this);
            this.bind('stop', this._stop, this);
            this.bind('setmute', this._setMute, this);
        },
        _reset() {
            this._stop();
            this.audio.src = this.url = '';
            this.isPlaying = false;
        },
        _load(t, url, success, fail) {
            const that = this;
            this.url = url;
            if (this.failHandler) {
                clearTimeout(this.failHandler);
            }

            function listener() {
                that.audio.removeEventListener('canplaythrough', listener, false);
                that.trigger('songloaded', that._getLoadedPercent());
                if (that.failHandler) clearTimeout(that.failHandler);
                if (success) success();
            }
            this.failHandler = setTimeout(() => {
                that.audio.removeEventListener('canplaythrough', listener, false);
                if (fail) {
                    fail();
                }
            }, 5E3);
            this.audio.addEventListener('canplaythrough', listener, false);
            console.log('[清爽贴吧]播放语音: ', url);
            this.audio.src = url;
        },
        _play(t, updateTotal, updateTime, finish) {
            const that = this;
            if (!this.isPlaying) {
                const totalTime = this.audio.duration * 1000;
                this.audio.play();
                if (this.checkFinishedHandler) {
                    clearTimeout(this.checkFinishedHandler);
                }
                this.isPlaying = true;
                if (updateTotal) {
                    updateTotal({
                        totalTime,
                    });
                }
                this.checkFinishedHandler = setTimeout(function getTime() {
                    const currentTime = that.audio.currentTime * 1000;
                    const percent = currentTime / totalTime;
                    if (updateTime) {
                        updateTime({
                            percent,
                            totalTime,
                            currentTime,
                        });
                    }
                    if (that.audio.ended) {
                        that.trigger('playfinish', 1);
                        if (finish) finish();
                    } else {
                        setTimeout(getTime, 500);
                    }
                }, 1E3);
            }
        },
        _pause() {
            if (this.isPlaying) {
                this.audio.pause();
                this.isPlaying = false;
            }
        },
        _stop() {
            this.audio.pause();
            if (this.checkFinishedHandler) {
                clearTimeout(this.checkFinishedHandler);
            }
            this.isPlaying = false;
        },
        _setMute(t, isMute) {
            this.audio.muted = this.isMute = isMute;
        },
        _setVolume(t, volume) {
            this.volume = volume;
            this.audio.volume = volume / 100;
        },
        _setCurrentPosition() {},
        _getCurrentPosition() {
            return this.audio.currentTime / this.audio.duration;
        },
        _getLoadedPercent() {
            return this.audio.buffered.end(this.audio.buffered.length - 1) / this.audio.duration;
        },
        _getTotalTime() {
            return this.audio.duration * 1000;
        },
        _getCurrentTime() {
            return this.audio.currentTime * 1000;
        },
    };
    const specialModules = getSpecialModules(noop, emptyStr, html5AudioPlayer);
    // Logging
    let logBlocked, logPassed;
    console.info('[清爽贴吧]正在运行中' + (window.top === window ? '' : `(from iframe: ${location.href})`));

    if (debugMode) {
        const blocked = {
                script: [],
                module: [],
                bigpipe: [],
                element: [],
            },
            passed = [];
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
        const prop = parent[name];
        if (prop) {
            const newProp = filter(prop);
            if (newProp && newProp !== prop) parent[name] = newProp;
            return;
        }
        const {
            enumerable = true,
                writable = true,
        } = Object.getOwnPropertyDescriptor(parent, name) || {};
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
                });
                toFastProperties(parent);
                return true;
            },
        });
    }

    function hijack(parent, path, filter) {
        const name = path.split('.');
        let pos = 0;
        if (name.length === 1) return hijackOnce(parent, path, filter);
        (function f(node) {
            if (pos === name.length) return filter(node);
            hijackOnce(node, name[pos++], f);
        }(parent));
    }

    const sensitiveWordsRegExp = new RegExp(`(^|\\b|_)(${sensitiveWordsV2.join('|')})($|\\b|_)`, 'i');

    function hasSensitiveWords(text) {
        return sensitiveWordsRegExp.test(text.replace(/([A-Z])/g, '_$1'));
    }
    // Bigpipe
    hijack(window, 'Bigpipe', Bigpipe => {
        // 加载过滤
        function check(name) { // 放行返回true
            if (bigpipeBlackList.includes(name) || hasSensitiveWords(name) && !bigpipeWhiteList.includes(name)) {
                if (debugMode) logBlocked('bigpipe', name);
                return false;
            }
            return true;
        }
        const _register = Bigpipe.register;
        Bigpipe.register = function(name, info) {
            if (!check(name)) {
                return {
                    then: noop,
                };
            }
            if (info.scripts) info.scripts = info.scripts.filter(check);
            if (info.styles) info.styles = info.styles.filter(check);
            return _register.call(Bigpipe, name, info);
        };
        // 模板过滤
        Bigpipe.debug(true);
        const Pagelet = Bigpipe.Pagelet;
        Bigpipe.debug(false);
        toFastProperties(Bigpipe);
        Pagelet.prototype._getHTML = function() { // 略微提高性能
            let html, elem;
            if (typeof this.content !== 'undefined') { // 钦定了this.content
                html = this.content;
            } else {
                elem = document.getElementById('pagelet_html_' + this.id);
                if (elem) { // 从模板中获取
                    html = elem.firstChild.data; // 不要使用正则
                    elem.remove(); // 移除模板移到这里，以免多次getElementById (review: getElementById其实是有缓存的……不知道自己当时在想什么
                } else { // 什么都没有
                    return false;
                }
            }
            return html;
        };
        let $tempFragement,
            clearId = 0;
        const tempFragement = document.createDocumentFragment(),
            cleaner = function() { // 不要在当前事件cleanData
                if (!$tempFragement) $tempFragement = window.jQuery(tempFragement);
                $tempFragement.empty();
                clearId = 0;
            };

        function empty(elem) { // 用jq是为了尝试解决内存泄漏，先把内容移出，一会把内容cleanData(因为比较费时)
            if (!elem.hasChildNodes()) return;
            if (!window.jQuery) {
                elem.innerHTML = '';
                return;
            }
            while (elem.firstChild) tempFragement.appendChild(elem.firstChild);
            if (!clearId) clearId = setTimeout(cleaner, 50);
        }
        const template = document.createElement('template');
        Pagelet.prototype._appendTo = function(pagelet) {
            if (!(pagelet instanceof Pagelet)) throw new TypeError(pagelet + 'is not a pagelet.');
            const LOADED = 1;
            if (this.state >= LOADED) throw new Error('pagelet[' + this.id + '] is already mounted');
            const content = this._getHTML();
            if (content !== false) {
                if (!pagelet.document) throw new Error('Cannot append pagelet[' + this.id + '] to documentless pagelet[' + pagelet.id + ']');
                const doc = this.document = this._getPlaceholder(pagelet.document);
                if (!doc) throw new Error('Cannot find the placeholder for pagelet[' + this.id + ']');
                empty(doc); // 清空doc
                if (content) {
                    template.innerHTML = content; // fix: range.createContextualFragment() will load the resources unexpectedly
                    const fragment = template.content;
                    for (const elem of fragment.querySelectorAll(selector)) { // NodeList is immutable
                        elem.remove();
                        if (debugMode) logBlocked('element', elem);
                    }
                    const scripts = fragment.querySelectorAll('script'); // NodeList is immutable
                    doc.appendChild(fragment);
                    for (const script of scripts) { // imperfect fix: <script> doesn't work
                        const replacement = document.createElement('script');
                        for (const attr of script.attributes) {
                            replacement.attributes.setNamedItem(attr.cloneNode());
                        }
                        if (script.firstChild) replacement.appendChild(script.firstChild);
                        script.replaceWith(replacement);
                    }
                }
            }
            return this;
        };
    });
    // 模块过滤
    hijack(window, '_.Module', Module => {
        function check(module) { // 放行返回true
            if (moduleBlackList.includes(module) || hasSensitiveWords(module) && !moduleWhiteList.includes(module) || specialModules.block[module]) {
                if (debugMode) logBlocked('module', module);
                return false;
            }
            return true;
        }
        const _use = Module.use;
        Module.use = function(a, b, c, d) {
            if (!check(a)) return;
            return _use.call(Module, a, b, c, d);
        };
        const defined = new Map();
        const DEFINED_STATES = {
            PASSED: 1,
            BLOCKED: 2,
            OVERRIDED: 3,
        };
        const createInitial = debugMode ? function(path) {
            return function() {
                Object.setPrototypeOf(this, new Proxy(Object.getPrototypeOf(this), {
                    get(target, property, receiver) {
                        if (property in target) return target[property];
                        //debugger;
                        console.warn('[清爽贴吧]Undefined property:', path, property, defined.get(path), target);
                        return function() {
                            //debugger;
                        };
                    },
                }));
            };
        } : createNoop;

        const _define = Module.define;

        function fakeDefine(path, sub_ori) {
            if (defined.has(path)) {
                if (debugMode && sub_ori && !defined.get(path)) defined.set(path, sub_ori);
                return;
            }
            const sub = {
                initial: createInitial(path), // 不用同一个initial，因为这上面会被做标记
            };
            const overrider = specialModules.block[path];
            if (overrider) Object.assign(sub, overrider);
            defined.set(path, debugMode ? sub_ori : DEFINED_STATES.BLOCKED);
            _define.call(Module, {
                path,
                sub,
            });
        }

        function moduleFilter(path) {
            return check(path) || (fakeDefine(path), false);
        }
        Module.define = function(info) {
            if (!check(info.path)) return fakeDefine(info.path, info.sub);
            if (info.requires) {
                if (Array.isArray(info.requires)) {
                    info.requires = info.requires.filter(moduleFilter);
                } else if (typeof info.requires === 'string') {
                    if (!check(info.requires)) {
                        fakeDefine(info.requires);
                        info.requires = undefined;
                    }
                } else {
                    console.warn('[清爽贴吧]遇到问题：未知的requires字段', info);
                }
            }
            if (specialModules.hook[info.path]) specialModules.hook[info.path](info);
            const overrider = specialModules.override[info.path];
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
            configurable: false,
        });
    }
    // 广告过滤
    setNoop(window, 'BAIDU_VIDEO_FROAD_FILL');
    setNoop(window, 'BAIDU_VIDEO_FROAD_FILL_RENDERFRAME');
    // 统计过滤
    setNoop(window, 'alog');
    setNoop(window, 'passFingerload');
    hijack(window, 'PageLink', PageLink => {
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
    hijack(window, 'jQuery', $ => {
        // 理由同上，前人挖坑后人埋
        Object.defineProperty(window, '$', {
            value: $,
            configurable: true,
            enumerable: true,
            writable: false,
        });
        hijack($, 'stats', stats => {
            for (const name of Object.keys(stats)) {
                setNoop(stats, name);
            }
        });
        // 允许关闭对话框
        hijack($, 'dialog', Dialog => class ForceCloseableDialog extends Dialog {
            constructor(config) {
                if (config.closeable === false) {
                    config.closeable = true;
                    console.log('[清爽贴吧]已允许关闭对话框：', config);
                }
                super(config);
            }
        });
        // wtf???  奇奇怪怪的bug处理
        {
            const offset = $.fn.offset;
            $.fn.offset = function(...args) {
                const res = offset.call(this, ...args);
                if (res) return res;
                return new Error().stack.includes('UserMessage.js') ? {
                    left: 0
                } : res;
            };
        }
    });
    // 免登录看帖
    hijack(window, 'PageData.user', user => {
        if (user.is_login) return; // 已登录
        let is_login = false; // 不能直接设置成1，因为会影响右上角显示，感谢@榕榕
        document.addEventListener('DOMContentLoaded', () => { // DOM加载完成后改成已登录状态
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
    const originalSrc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
    Object.defineProperty(HTMLScriptElement.prototype, 'src', {
        ...originalSrc,
        set(src) {
            if (scriptBlackListRule.test(src)) return debugMode && logBlocked('script', src), true;
            return originalSrc.set.call(this, src);
        },
    });
    hijack(EventTarget, 'prototype', prototype => { // 滚动速度提升
        const eventTypes = 'wheel,mousewheel,DOMMouseScroll,MozMousePixelScroll,scroll,touchstart,touchmove,touchend,touchcancel,mousemove'.split(',');
        const _add = prototype.addEventListener,
            _remove = prototype.removeEventListener;
        prototype.addEventListener = function(type, handler, capture) {
            if (!eventTypes.includes(type) || typeof capture !== 'boolean' || ![window, document, document.body].includes(this) || new Error().stack.includes('eval')) return _add.call(this, type, handler, capture);
            if (type === 'mousemove') return; // 监听这个的都是分享、XSS监控这种鸡肋玩意
            return _add.call(this, type, handler, {
                capture,
                passive: true,
            });
        }
        prototype.removeEventListener = function(type, handler, capture) {
            if (!eventTypes.includes(type) || typeof capture !== 'boolean') return _remove.call(this, type, handler, capture);
            return _remove.call(this, type, handler, {
                capture,
                passive: true,
            });
        }
    });
}
const toFastProperties = `function toFastProperties(obj) {
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
    const s = document.createElement('script');
    s.textContent = `(${inject}(${JSON.stringify(setting)},${getSpecialModules},${toFastProperties}))`;
    document.documentElement.appendChild(s);
    s.remove();
}());
(function() { // 特殊广告处理
    document.addEventListener('animationstart', event => {
        const target = event.target;
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
                const txt = String.fromCharCode(...[].map.call(target.querySelectorAll('.BDE_Colorful'), elem => elem.getAttribute('code')));
                target.innerHTML = '';
                target.appendChild(document.createTextNode(txt));
                break;
            case 'ad_bottom_view':
                const post = target.closest('.l_post');
                if (post) post.remove();
                break;
        }
    }, false);
}());
