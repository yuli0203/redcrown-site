/* עמודי המדיניות: קושרים את מספר הטלפון והשנה מתוך ההגדרות
   The policy pages: bind the phone number and the year from the config. */
(function () {
  'use strict';
  var CFG = window.KERTSMAN_CONFIG || {};
  var digits = (CFG.phoneIntl || '').replace(/\D/g, '');

  function ready() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-cfg="phone"]'), function (node) {
      node.textContent = CFG.phone || '';
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-link]'), function (node) {
      var kind = node.getAttribute('data-link');
      if (kind === 'tel') node.href = 'tel:+' + digits;
      else if (kind === 'wa') {
        node.href = 'https://wa.me/' + digits + '?text=' + encodeURIComponent(node.getAttribute('data-wa-text') || '');
      }
    });
    var year = new Date().getFullYear();
    Array.prototype.forEach.call(document.querySelectorAll('#year, #year-credit'), function (node) {
      node.textContent = year;
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
