function inject() {
    'use strict';
    var debugMode = true;

    function createNoop() {
        return function() {}
    };
    var noop = createNoop();

    function emptyStr() {
        return ''
    };
    if (Object.freeze) Object.freeze(noop), Object.freeze(emptyStr);
    // Fxck PercentLoaded
    Object.defineProperties(HTMLEmbedElement.prototype, {
        PercentLoaded: {
            configurable: true,
            enumerable: false,
            value: () => 100,
            writable: true
        },
        getData: {
            configurable: true,
            enumerable: false,
            value: () => {},
            writable: true
        },
        setData: {
            configurable: true,
            enumerable: false,
            value: () => {},
            writable: true
        }
    });
    // Logging
    var log = noop;
    console.info('清爽贴吧正在运行中');
    if (debugMode) {
        var arr = [],
            arr2 = [];
        log = function(txt) {
            arr.push(txt)
        }
        console.info('被过滤的模块:', arr);
        console.info('被放行的模块:', arr2);
    }
    // 劫持用
    function hijackOnce(parent, name, filter) {
        var prop = parent[name];
        if (prop) {
            var newProp = filter(prop);
            if (newProp && newProp !== prop) parent[name] = newProp;
        } else {
            Object.defineProperty(parent, name, {
                configurable: true,
                enumerable: true,
                get: noop,
                set: function(e) {
                    Object.defineProperty(parent, name, {
                        configurable: true,
                        enumerable: true,
                        writable: true,
                        value: filter(e) || e
                    });
                }
            });
        }
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
    // what to filter
    var sensitiveWords = ['encourage', 'entertainment', 'hottopic', 'firework', 'adsense', 'dasense', 'stat', 'money', 'game', 'tcharge', 'vip', 'tdou', 'celebrity', 'tbmall', 'wallet', 'cashier', 'qianbao', 'purchase', 'track', 'stock', 'promoter', 'pay', 'u9aside', 'duoku', 'xiu8', 'meizhi', 'adpost', 'advertise', 'recommend', 'props', 'snowflow', 'saveface', 'medal', 'pkfixedbubble', 'locality', 'topicrank', 'force_login', 'urlcheck', 'share', 'flashlcs', 'icons', 'asidead', 'platformweal', 'headrecom', 'spreadad', 'asidead', 'score', 'icon', 'localpbtop', 'fakegif', 'localposter', 'interaction', 'comtrial', 'cpro', 'pc2client', 'tenyears', 'pad_overlay', 'spageliveshowslide', 'aside_platform', 'avideo', 'tb_gram', 'live_tv'];
    var whiteList = ['album/component/initApiConfig'];

    function hasSensitiveWords(text) {
        text = text.toLowerCase();
        return sensitiveWords.some(function(word) {
            return text.includes(word);
        });
    }
    // Bigpipe
    hijack(window, 'Bigpipe', function(Bigpipe) {
        // 加载过滤
        var names = ['frs-aside/pagelet/ad'];
        var _register = Bigpipe.register;

        function check(name) { // 放行返回true
            return !hasSensitiveWords(name) || whiteList.includes(name);
        }

        function loadingFilter(name) {
            return check(name) || (log('Blocked loading: ' + name), false);
        }
        Bigpipe.register = function(name, info) {
            if (names.includes(name) || !check(name)) {
                log('Blocked loading: ' + name);
                return {
                    then: noop
                };
            }
            if (info.scripts) info.scripts = info.scripts.filter(loadingFilter);
            if (info.styles) info.styles = info.styles.filter(loadingFilter);
            return _register.call(Bigpipe, name, info);
        };
        // 模板过滤
        var selector = '[id="pagelet_frs-aside/pagelet/ad"],[id*="encourage"],[id*="entertainment"],[id*="hottopic"],[id*="firework"],[class*="encourage"],[class*="entertainment"],[class*="firework"]';

        function elementFilter(html) {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            [].forEach.call(doc.querySelectorAll(selector), function(elem) {
                var noscript = doc.createElement('noscript');
                noscript.id = elem.id;
                noscript.className = elem.className;
                elem.parentNode.replaceChild(noscript, elem);
                log('Blocked element: ' + ('id' in elem ? ('id="' + elem.id + '"') : ('class="' + elem.className + '"')));
            });
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
        var blackList = ['ueditor/widget/topic_suggestion', 'puser/widget/myApp', 'fanclub/widget/fancard'];

        function check(module) { // 放行返回true
            if (blackList.includes(module) || hasSensitiveWords(module) && !whiteList.includes(module)) {
                log('Blocked module: ' + module);
                return false;
            }
            return true;
        }
        var _use = Module.use;
        Module.use = function(a, b, c, d) {
            if (!check(a)) return;
            return _use.call(Module, a, b, c, d);
        }
        var specialModules = {
            "props/component/PropsApi": {
                showUIHtml: emptyStr
            },
            "puser/component/PropsApi": {
                showUIHtml: emptyStr
            },
            "props/component/PropsApi": {
                showUI: emptyStr,
                showUIHtml: emptyStr
            },
            "user/widget/icons": {
                getPreIconHtml: emptyStr,
                getTbvipIconHtml: emptyStr,
                getIconsHtml: emptyStr
            },
            "puser/widget/icons": {
                getPreIconHtml: emptyStr,
                getTbvipIconHtml: emptyStr,
                getIconsHtml: emptyStr
            },
            "props/widget/Residual": {
                showUI: emptyStr
            },
            "user/widget/month_icon": {
                getMonthIcon: emptyStr
            },
            "puser/widget/MonthIcon": {
                getMonthIcon: emptyStr
            },
            "ihome/widget/MonthIcon": {
                getMonthIcon: emptyStr
            },
            "user/widget/interaction": {
                _resetDataObj: noop
            },
            "puser/widget/Interaction": {
                _resetDataObj: noop
            },
            "ihome/widget/Interaction": {
                _resetDataObj: noop
            },
            "tbui/widget/tbshare_popup": {
                setShareContent: noop
            },
            "tbmall/component/util": {
                getMaxLevel: function() {
                    return 0
                }
            },
        };
        var defined = {};
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
                        }
                    }
                }));
            }
        }

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

        function requireInstanceAsync(path) {
            if (!check(path)) return fakeDefine(path);
            this.__checkUse(path);
            Module.use.apply(null, arguments);
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
                        delete info.requires;
                    }
                } else {
                    console.warn('贴吧精简脚本遇到问题：未知的requires字段', info);
                }
            };
            if (info.sub) info.sub.requireInstanceAsync = requireInstanceAsync;
            defined[info.path] = 1;
            if (debugMode) arr2.push(info.path);
            return _define.call(Module, info);
        }
    });
    // 统计过滤
    function setNoop(parent, name) {
        Object.defineProperty(parent, name, {
            value: noop,
            writable: false,
            configurable: false
        });
    }
    setNoop(window, 'alog');
    hijack(window, '$', function($) {
        hijack($, 'stats', function(stats) {
            ['hive', 'processTag', 'scanPage', 'sendRequest', 'track', 'redirect'].forEach(function(name) {
                setNoop(stats, name);
            });
        });
        hijack($, 'swf', function(swf) { // 没什么卵用，不想看见报错而已
            setNoop(swf, 'remote');
        });
    });
    // 免登录看帖
    hijack(window, 'PageData.user', function(user) {
        if (user.is_login) return; // 已登录
        var is_login = false; // 不能直接设置成1，因为会影响右上角显示，感谢@榕榕
        document.addEventListener('DOMContentLoaded', function listener() { // DOM加载完成后改成已登录状态
            is_login = 1;
            document.removeEventListener('DOMContentLoaded', listener, true);
        }, true)
        Object.defineProperty(user, 'is_login', { // 不直接改，因为会被Object.freeze()，换成getter（虽然PB页现在不freeze
            configurable: false,
            get: function() {
                return is_login
            }
        });
    });
}
(function() {
    var s = document.createElement('script');
    s.textContent = '(' + inject.toString() + '())';
    document.documentElement.appendChild(s);
    s.remove();
}())