var templarTools;

(function () {
  var _ = templarTools = {};

  _.oapply = function (obj, ref, all) {
    obj = obj || {};
    for (var k in ref) if (all || k[0] !== '_') obj[k] = ref[k];
    return obj;
  }
  _.rapply = function (obj, ref) {
    if (!obj || !ref) return;
    for (var k in obj) if (k[0] === '$') ref[k] = obj[k];
  }

  _.isfn = function (val) { return typeof val === 'function'; }
  _.isobj = function (val) { return typeof val === 'object'; }
  _.isstr = function (val) { return typeof val === 'string'; }
  _.isarr = function (val) { return typeof val !== 'undefined' && val instanceof Array; }
  _.isElement = function (obj) { return obj instanceof Element; }
  _.isText = function (obj) { return obj instanceof Text; }
  _.isComment = function (obj) { return obj instanceof Comment; }
  _.isDocFrag = function (obj) { return obj instanceof DocumentFragment; }
  _.rxMatch = function (rx, str, i) {
    if (!(rx instanceof RegExp) || !rx.test(str)) return;
    return rx.exec(str)[i];
  }

  _.isAttached = function (el) {
    return el.closest('body') ? true : false;
  }
  _.isNwText = function (obj) {
    if (_.isText(obj) && !_.isws(obj.wholeText)) return true;
  }
  _.isws = function (str) { return /^\s*$/.test(str); }

  _.isolateText = function (obj) {
    if (!_.isNwText(obj)) return obj;
    var first = obj, last = obj, par = obj.parentNode;
    while (_.isText(first.previousSibling)) first = first.previousSibling;
    while (_.isText(last.nextSibling)) last = last.nextSibling;
    if (!first.previousSibling && !last.nextSibling) {
      var par = obj.parentNode
      if (first === last) return par.firstChild;
      par.textContent = par.textContent;
      return par.firstChild;
    } else {
      var span = document.createElement('span');
      _.before(span, first);
      span.textContent = first.wholeText;
      _.getRange(first, last).deleteContents();
      return span;
    }
  }
  _.getFragEnds = function (el) {
    if (!_.isDocFrag(el)) return;
    return [el.firstChild, el.lastChild];
  }
  _.getRange = function (first, last) {
    if (!first) return;
    if (_.isarr(first)) { last = first[1]; first = first[0]; }
    var rng = document.createRange();
    rng.setStartBefore(first); rng.setEndAfter(last);
    return rng;
  }
  _.elDel = function (el, dir) {
    if ((el = _.elCheck(el)) === undefined) return;
    var eParent = _.elCheck(el.parentNode);
    if (eParent === undefined) return;
    eParent.removeChild(el);
  }
  _.before = function (eNew, eRef) {
    if ((eRef = _.elCheck(eRef)) === undefined) return;
    var eParent = _.elCheck(eRef.parentNode);
    if (eParent === undefined) return;
    var ends = _.getFragEnds(eNew);
    eParent.insertBefore(eNew, eRef);
    if (!ends) return eNew;
    else return _.getRange(ends);
  }
  _.append = function (eNew, ePar) {
    if ((ePar = _.elCheck(ePar)) === undefined) return;
    var ends = _.getFragEnds(eNew);
    ePar.appendChild(eNew);
    if (!ends) return eNew;
    else return _.getRange(ends);
  }
  _.elHasAttribute = function (obj, name) {
    if (!_.isElement(obj)) return false;
    if (_.isfn(obj.hasAttribute)) return false;
    return obj.hasAttribute(name);
  }
  _.elCheck = function (el) {
    if (!el) return undefined;
    if (_.isstr(el)) el = document.querySelector(el);
    if (!_.isElement(el) && !_.isDocFrag(el) && !_.isText(el) && !_.isComment(el))
      return undefined;
    if (el.content) el = el.content;
    return el;
  }
  _.removeParent = function (el) {
    var rng = _.getRange(el.firstChild, el.lastChild);
    return rng.extractContents();
  }
  _.nodePath = function (el) {
    var retval = [];
    while (el) {
      retval.unshift(el.nodeName || el.tagName);
      el = el.parentNode;
    }
    return retval.join('->');
  }

})();

if (!Element.prototype.matches)
  Element.prototype.matches = Element.prototype.msMatchesSelector ||
    Element.prototype.webkitMatchesSelector;

if (!Element.prototype.closest) {
  Element.prototype.closest = function (s) {
    var el = this;
    if (!document.documentElement.contains(el)) return null;
    do {
      if (el.matches(s)) return el;
      el = el.parentElement || el.parentNode;
    } while (el !== null && el.nodeType === 1);
    return null;
  };
}