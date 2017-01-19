/*jshint esversion: 6 */
function inject(setting, getSpecialModules) {
    'use strict';
    var {
        debugMode,
        sensitiveWords,
        selector,
        bigpipeWhiteList,
        bigpipeBlackList,
        moduleWhiteList,
        moduleBlackList,
    } = setting;

    function createNoop() {
        return function() {};
    }
    var noop = createNoop();

    function emptyStr() {
        return '';
    }
    if (Object.freeze) {
        Object.freeze(noop);
        Object.freeze(emptyStr);
    }
    var specialModules = getSpecialModules(noop, emptyStr);
    // Logging
    var log;
    console.info('清爽贴吧正在运行中');
    if (debugMode) {
        var arr = [],
            arr2 = [];
        log = function(txt) {
            arr.push(txt);
        };
        console.info('被过滤的模块:', arr);
        console.info('被放行的模块:', arr2);
    }
    // 劫持用
    function hijackOnce(parent, name, filter) {
        var prop = parent[name];
        if (prop) {
            var newProp = filter(prop);
            if (newProp && newProp !== prop) parent[name] = newProp;
            return;
        }
        var descriptor = Object.getOwnPropertyDescriptor(parent, name) || {
            configurable: true,
            writable: true,
            enumerable: true
        };
        var writable = descriptor.writable;
        delete descriptor.value;
        delete descriptor.writable;
        Object.defineProperty(parent, name, Object.assign({}, descriptor, {
            get: noop,
            set: function(e) {
                delete descriptor.get;
                delete descriptor.set;
                descriptor.writable = writable;
                descriptor.value = filter(e) || e;
                Object.defineProperty(parent, name, descriptor);
            }
        }));
    }

    function hijack(parent, path, filter) {
        var name = path.split('.'),
            pos = 0;
        if (name.length === 1) return hijackOnce(parent, path, filter);
        (function f(node) {
            if (pos === name.length) return filter(node);
            hijackOnce(node, name[pos++], f);
        }(parent));
    }

    function hasSensitiveWords(text) {
        text = text.toLowerCase();
        return sensitiveWords.some(function(word) {
            return text.includes(word);
        });
    }
    //delete window.Promise; // Chrome上使用自带的Promise会在Take Heap Snapshot时使页面崩溃
    // Bigpipe
    hijack(window, 'Bigpipe', function(Bigpipe) {
        // 加载过滤
        function check(name) { // 放行返回true
            if (bigpipeBlackList.includes(name) || hasSensitiveWords(name) && !bigpipeWhiteList.includes(name)) {
                if (debugMode) log('Blocked loading: ' + name);
                return false;
            }
            return true;
        }
        var _register = Bigpipe.register;
        Bigpipe.register = function(name, info) {
            if (!check(name)) return {
                then: noop
            };
            if (info.scripts) info.scripts = info.scripts.filter(check);
            if (info.styles) info.styles = info.styles.filter(check);
            return _register.call(Bigpipe, name, info);
        };
        // 模板过滤
        function remove(elem) {
            elem.remove();
        }
        var forEach = [].forEach;

        function elementFilter(html) {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            forEach.call(doc.querySelectorAll(selector), debugMode ? function(elem) {
                var id, className;
                if (elem.hasAttribute('id')) id = elem.id;
                if (elem.hasAttribute('class')) className = elem.className;
                remove(elem);
                log('Blocked element: ' + (id ? `id="${id}"` : `class="${className}"`));
            } : remove);
            return doc.body.innerHTML;
        }
        Bigpipe.debug(true);
        //var _getHTML = Bigpipe.Pagelet.prototype._getHTML;
        Bigpipe.Pagelet.prototype._getHTML = function() {
            if ("undefined" !== typeof this.content) return this.content;
            var elem = document.getElementById('pagelet_html_' + this.id);
            if (!elem) return false;
            var model = elem.innerHTML.trim().match(/^<!--([\s\S]*)-->$/);
            return model ? elementFilter(model[1]) : '';
        };
        Bigpipe.debug(false);
    });
    // 模块过滤
    hijack(window, '_.Module', function(Module) {
        function check(module) { // 放行返回true
            if (moduleBlackList.includes(module) || hasSensitiveWords(module) && !moduleWhiteList.includes(module)) {
                if (debugMode) log('Blocked module: ' + module);
                return false;
            }
            return true;
        }
        var _use = Module.use;
        Module.use = function(a, b, c, d) {
            if (!check(a)) return;
            return _use.call(Module, a, b, c, d);
        };
        var defined = Object.create ? Object.create(null) : {};
        var createDebugInitial;
        if (debugMode) createDebugInitial = function(path) {
            return function() {
                Object.setPrototypeOf(this, new Proxy(Object.getPrototypeOf(this), {
                    get(target, property, receiver) {
                        if (property in target) return target[property];
                        //debugger;
                        console.warn('Undefined property:', path, property, defined[path], target);
                        return function() {
                            //debugger;
                        };
                    }
                }));
            };
        };

        function fakeDefine(path, sub_ori) {
            if (defined[path]) {
                if (debugMode && sub_ori && ('nosub' === defined[path])) defined[path] = sub_ori;
                return;
            }
            var sub = {
                initial: debugMode ? createDebugInitial(path) : createNoop() // 不用同一个initial，因为这上面会被做标记
            };
            if (specialModules[path]) Object.assign(sub, specialModules[path]);
            defined[path] = debugMode ? (sub_ori || 'nosub') : 2;
            _define.call(Module, {
                path,
                sub
            });
        }

        function moduleFilter(path) {
            return check(path) || (fakeDefine(path), false);
        }
        var _define = Module.define;
        Module.define = function(info) {
            if (!check(info.path)) return fakeDefine(info.path, info.sub);
            if (info.requires) {
                if (info.requires instanceof Array) {
                    info.requires = info.requires.filter(moduleFilter);
                } else if ('string' === typeof info.requires) {
                    if (!check(info.requires)) {
                        fakeDefine(info.requires);
                        info.requires = undefined;
                    }
                } else {
                    console.warn('贴吧精简脚本遇到问题：未知的requires字段', info);
                }
            }
            defined[info.path] = 1;
            if (debugMode) arr2.push(info.path);
            return _define.call(Module, info);
        };
    });
    // Fxck PercentLoaded
    Object.defineProperties(HTMLEmbedElement.prototype, {
        PercentLoaded: {
            configurable: true,
            enumerable: false,
            value() {
                return 100;
            },
            writable: true
        },
        getData: {
            configurable: true,
            enumerable: false,
            value: noop,
            writable: true
        },
        setData: {
            configurable: true,
            enumerable: false,
            value: noop,
            writable: true
        }
    });

    function setNoop(parent, name) {
        Object.defineProperty(parent, name, {
            value: noop,
            writable: false,
            configurable: false
        });
    }
    // 统计过滤
    setNoop(window, 'alog');
    hijack(window, '$.stats', function(stats) {
        ['hive', 'processTag', 'scanPage', 'sendRequest', 'track', 'redirect'].forEach(function(name) {
            setNoop(stats, name);
        });
    });
    // 免登录看帖
    hijack(window, 'PageData.user', function(user) {
        if (user.is_login) return; // 已登录
        var is_login = false; // 不能直接设置成1，因为会影响右上角显示，感谢@榕榕
        document.addEventListener('DOMContentLoaded', function() { // DOM加载完成后改成已登录状态
            is_login = 1;
        }, {
            capture: true,
            once: true,
            passive: true
        });
        Object.defineProperty(user, 'is_login', { // 不直接改，因为会被Object.freeze()，换成getter（虽然PB页现在不freeze
            get() {
                return is_login;
            }
        });
    });
    hijack(EventTarget, 'prototype', function(prototype) { // 滚动速度提升
        var eventTypes = 'wheel,mousewheel,DOMMouseScroll,MozMousePixelScroll,scroll,touchstart,touchmove,touchend,touchcancel'.split(',');
        var _add = prototype.addEventListener,
            _remove = prototype.removeEventListener;
        prototype.addEventListener = function(type, handler, capture) {
            if ('mousemove' === type) return; // 监听这个的都是分享、XSS监控这种鸡肋玩意
            if (!eventTypes.includes(type) || 'boolean' !== typeof capture) return _add.call(this, type, handler, capture);
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
(function() {
    'use strict';
    var s = document.createElement('script');
    s.textContent = `(${inject}(${JSON.stringify(setting)},${getSpecialModules}))`;
    document.documentElement.appendChild(s);
    s.remove();
}());