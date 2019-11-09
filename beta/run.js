'use strict'
/* global inject setting getSpecialModules html5AudioPlayer initGeeTestService */
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
}` // from bluebird, use string to avoid 'eval'
;(function() {
  const s = document.createElement('script')
  s.textContent = `(${inject}(${JSON.stringify(
    setting,
  )},${getSpecialModules},${html5AudioPlayer},${initGeeTestService},${toFastProperties}))`
  document.documentElement.appendChild(s)
  s.remove()
})()
;(function() {
  // 特殊广告处理
  document.addEventListener(
    'animationstart',
    event => {
      const target = event.target
      switch (event.animationName) {
        case 'ads_need_remove':
          target.remove()
          break
        case 'ps_cb_ad':
          target.replaceWith(target.firstChild)
          break
        case 'colorful_idiots':
          target.classList.remove('post_props_colorful')
          target.classList.remove('post_props_1040001')
          // eslint-disable-next-line no-case-declarations
          const txt = String.fromCharCode(
            ...[].map.call(target.querySelectorAll('.BDE_Colorful'), elem =>
              elem.getAttribute('code'),
            ),
          )
          target.innerHTML = ''
          target.appendChild(document.createTextNode(txt))
          break
        case 'ad_bottom_view':
          // eslint-disable-next-line no-case-declarations
          const post = target.closest('.l_post')
          if (post) post.remove()
          break
        case 'process_kw1':
          target.classList.add('process_kw1')
          target.addEventListener('keydown', e => {
            if (e.keyCode === 13) {
              e.preventDefault()
              const enter = document.querySelector('.j_enter_ba')
              enter && enter.click()
            }
          })
          break
      }
    },
    false,
  )
})()
