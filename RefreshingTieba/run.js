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
    console.info('[清爽贴吧]正在运行中');
    if (debugMode) {
        var arr = [],
            arr2 = [];
        log = function(txt) {
            arr.push(txt);
        };
        console.info('[清爽贴吧]过滤的模块:', arr);
        console.info('[清爽贴吧]放行的模块:', arr2);
    }
    // 劫持用
    function hijackOnce(parent, name, filter) {
        var prop = parent[name];
        if (prop) {
            var newProp = filter(prop);
            if (newProp && newProp !== prop) parent[name] = newProp;
            return;
        }
        var configurable = true,
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
            }
        });
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
        Bigpipe.debug(true);
        var Pagelet = Bigpipe.Pagelet;
        Bigpipe.debug(false);
        var remove = debugMode ? function(elem) {
            var id, className;
            if (elem.hasAttribute('id')) id = elem.id;
            if (elem.hasAttribute('class')) className = elem.className;
            elem.remove();
            log('Blocked element: ' + (id ? `id="${id}"` : `class="${className}"`));
        } : function(elem) {
            elem.remove();
        };
        var range = document.createRange();
        range.selectNodeContents(document.documentElement);
        Pagelet.prototype._getHTML = function() { // 修改版在有元素时会返回一个装着元素的fragment以提高性能
            var html, elem;
            if ("undefined" !== typeof this.content) { // 钦定了this.content
                html = this.content;
            } else if (elem = document.getElementById('pagelet_html_' + this.id)) { // 从模板中获取
                html = elem.firstChild.data; // 不要使用正则
                elem.remove(); // 移除模板移到这里，以免多次getElementById
            } else { // 什么都没有
                return false;
            }
            if (!html) return html; // 没有元素时表现和原版一样
            var fragment = range.createContextualFragment(html),
                arr = fragment.querySelectorAll(selector), // NodeList is immutable
                l = arr.length;
            while (l--) remove(arr[l]);
            return fragment;
        };
        var $temp, temp = document.createDocumentFragment(),
            clearId = 0;

        function empty(elem) { // 用jq是为了尝试解决内存泄漏，先把内容移出，一会把内容cleanData(因为比较费时)
            var child;
            if (!elem.hasChildNodes()) return;
            if (!window.jQuery) return elem.innerHTML = '';
            while (child = elem.firstChild) temp.appendChild(child);
            if (!clearId) clearId = setTimeout(function() { // 不要在当前事件cleanData
                if (!$temp) $temp = jQuery(temp);
                $temp.empty();
                clearId = 0;
            }, 50);
        }
        var LOADED = 1;
        Pagelet.prototype._appendTo = function(pagelet) {
            if (!(pagelet instanceof Pagelet)) throw new TypeError(pagelet + "is not a pagelet.");
            if (this.state >= LOADED) throw new Error("pagelet[" + this.id + "] is already mounted");
            var content = this._getHTML();
            if (content !== false) {
                if (!pagelet.document) throw new Error("Cannot append pagelet[" + this.id + "] to documentless pagelet[" + pagelet.id + "]");
                var doc = this.document = this._getPlaceholder(pagelet.document);
                if (!doc) throw new Error("Cannot find the placeholder for pagelet[" + this.id + "]");
                empty(doc); // 清空doc
                if (content) doc.appendChild(content);
            }
            return this
        };
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
        var createInitial = debugMode ? function(path) {
            return function() {
                Object.setPrototypeOf(this, new Proxy(Object.getPrototypeOf(this), {
                    get(target, property, receiver) {
                        if (property in target) return target[property];
                        //debugger;
                        console.warn('[清爽贴吧]Undefined property:', path, property, defined[path], target);
                        return function() {
                            //debugger;
                        };
                    }
                }));
            };
        } : createNoop;

        function fakeDefine(path, sub_ori) {
            if (defined[path]) {
                if (debugMode && sub_ori && ('nosub' === defined[path])) defined[path] = sub_ori;
                return;
            }
            var sub = {
                initial: createInitial(path) // 不用同一个initial，因为这上面会被做标记
            };
            var sub2 = specialModules.block[path];
            if (sub2) Object.assign(sub, sub2);
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
                    console.warn('[清爽贴吧]遇到问题：未知的requires字段', info);
                }
            }
            var sub2 = specialModules.override[info.path];
            if (sub2) Object.assign(info.sub, sub2);
            defined[info.path] = 1;
            if (debugMode) arr2.push(info.path);
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
    // 统计过滤
    setNoop(window, 'alog');
    setNoop(window, 'passFingerload');
    hijack(window, '$', function($) {
        hijack($, 'stats', function(stats) {
            for (let name of ['hive', 'processTag', 'scanPage', 'sendRequest', 'track', 'redirect']) {
                setNoop(stats, name);
            }
        });
        // 允许关闭对话框
        hijack($, 'dialog', function(Dialog) {
            return class ForceCloseableDialog extends Dialog {
                constructor(config) {
                    if (config.closeable === false) {
                        //config.closeable = true;
                        console.log("[清爽贴吧]已允许关闭对话框：", config);
                    }
                    super(config);
                }
            };
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
        var eventTypes = 'wheel,mousewheel,DOMMouseScroll,MozMousePixelScroll,scroll,touchstart,touchmove,touchend,touchcancel,mousemove'.split(',');
        var _add = prototype.addEventListener,
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
(function() {
    'use strict';
    var s = document.createElement('script');
    s.textContent = `(${inject}(${JSON.stringify(setting)},${getSpecialModules}))`;
    document.documentElement.appendChild(s);
    s.remove();
}());
(function() { // 特殊广告处理
    'use strict';
    document.addEventListener("animationstart", function(event) {
        var target = event.target;
        switch (event.animationName) {
            case 'ps_cb_ad':
                target.replaceWith(target.firstChild);
                break;
            case 'temp_fix':
                target.appendChild(document.createElement('div'));
                break;
        }
    }, false);
}());
