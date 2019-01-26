'use strict';
var templarTools;

(function () {
  var _ = templarTools = {};

  _.oapply = function (obj, ref, node) {
    obj = obj || {};
    for (var k in ref) if (k[0] !== '_') obj[k] = ref[k];
    obj._node = _.isText(node) ? node.parentElement : node;
    return obj;
  };
  _.rapply = function (obj, ref) {
    if (!obj || !ref) return;
    for (var k in obj) if (k[0] === '$') ref[k] = obj[k];
  };

  _.isfn = function (val) { return typeof val === 'function'; };
  _.isobj = function (val) { return typeof val === 'object'; };
  _.isnull = function (val) { return val === null || val === void 0; };
  _.in = function (key, obj) { return _.isobj(obj) && (key in obj); };
  _.isstr = function (val) { return typeof val === 'string'; };
  _.isarr = function (val) { return typeof val !== 'void 0' && val instanceof Array; };
  _.isElement = function (obj) { return obj instanceof Element; };
  _.isText = function (obj) { return obj instanceof Text; };
  _.isComment = function (obj) { return obj instanceof Comment; };
  _.isDocFrag = function (obj) { return obj instanceof DocumentFragment; };
  _.rxAtt = function (rx) { return new RegExp('^(?:data-|x-)?' + rx.source, rx.flags); }

  _.isAttached = function (el) {
    if (el instanceof Attr) {
      if (el.ownerElement) el = el.ownerElement;
      else return false;
    } else if (_.isText(el) && el.parentElement) el = el.parentElement;
    return el.closest('body') ? true : false;
  };
  _.isSingleTextChild = function (obj) {
    return _.isElement(obj) && obj.childNodes.length === 1 && _.isText(obj.firstChild);
  };
  _.isNwText = function (obj) {
    return (_.isText(obj) && !_.isws(obj.wholeText));
  };
  _.isws = function (str) { return /^\s*$/.test(str); };

  _.getFragRange = function (el) {
    if (!_.isDocFrag(el)) return;
    return _.getRange(el);
  };
  _.isRange = function (el) { return el instanceof Range; };
  _.addComment = function (el, isBefore) {
    if (!_.isText(el)) return el;
    var fn = isBefore ? _.before : _.after;
    return fn(document.createComment('s'), el);
  };
  _.getRange = function (first, last) {
    if (!first) return;
    if (_.isDocFrag(first)) { last = first.lastChild; first = first.firstChild; }
    if (_.isRange(first) && first.resetBounds) return first.resetBounds();
    if (_.isarr(first)) { last = first[1]; first = first[0]; }
    if (first === last || last === void 0) return first;
    if (_.isText(first)) first = _.addComment(first, true);
    if (_.isText(last)) last = _.addComment(last, false);
    var rng = document.createRange();
    rng.firstNode = first; rng.lastNode = last;
    (rng.resetBounds = function () {
      rng.setStartBefore(first); rng.setEndAfter(last); return rng;
    })();
    return rng;
  };
  _.elRemove = function (el) {
    if (_.isRange(el) && el.resetBounds) return el.resetBounds().extractContents();
    if ((el = _.elCheck(el)) === void 0) return;
    var eParent = _.elCheck(el.parentNode);
    if (eParent === void 0) return;
    return eParent.removeChild(el);
  };
  _.after = function (eNew, eRef) { return _.before(eNew, eRef, 1); };
  _.before = function (eNew, eRef, after) {
    if (_.isRange(eRef)) eRef = after ? eRef.lastNode : eRef.firstNode;
    if ((eRef = _.elCheck(eRef)) === void 0) return;
    var eParent = _.elCheck(eRef.parentNode);
    if (eParent === void 0) return;
    if (_.isRange(eNew)) eNew = eNew.resetBounds().extractContents();
    var ends = _.getFragRange(eNew);
    eParent.insertBefore(eNew, after ? eRef.nextSibling : eRef);
    if (!ends) return eNew;
    else return _.getRange(ends);
  };
  _.append = function (eNew, ePar) {
    if ((ePar = _.elCheck(ePar)) === void 0) return;
    if (_.isRange(eNew)) eNew = eNew.resetBounds().extractContents();
    var ends = _.getFragRange(eNew);
    ePar.appendChild(eNew);
    if (!ends) return eNew;
    else return _.getRange(ends);
  };
  _.elHasAttribute = function (obj, name) {
    if (!_.isElement(obj)) return false;
    if (!_.isfn(obj.hasAttribute)) return false;
    return obj.hasAttribute(name);
  };
  _.elCheck = function (el) {
    if (!el) return void 0;
    if (_.isstr(el)) el = document.querySelector(el);
    if (!_.isElement(el) && !_.isDocFrag(el) && !_.isText(el) && !_.isComment(el))
      return void 0;
    if (el.content) el = el.content;
    return el;
  };
  _.checkEnds = function (el) {
    if (_.isDocFrag(el)) {
      _.addComment(el.firstChild, true);
      _.addComment(el.lastChild, false);
    }
    return el;
  };
  _.removeParent = function (el) {
    var rng = _.getRange(el.firstChild, el.lastChild);
    return _.elRemove(rng);
  };
  // _.nodePath = function (el) {
  //   var retval = [];
  //   while (el) {
  //     retval.unshift(el.nodeName || el.tagName);
  //     el = el.parentNode;
  //   }
  //   return retval.join('->');
  // };

  var thenArr = [], lastArr = [], thenState = false, thenStart = null
    //, oDone = [], firstThen = null
    , oEx = function (o) {
      //o.dt0 = Date.now();
      o.fn.apply(o.this, o.args);
      //o.dtF = Date.now();
      // oDone.push(o);
      // if (o.dtF - o.dt0 > 100)
      //   console.log(o.dtF - o.dt0, o);
    }
    , thenRun = function () {
      //if (!firstThen) firstThen = Date.now(); var cnt=0;
      var o;

      while ((o = thenArr.shift()) && thenArr.length > 10
        && (Date.now() - thenStart) < 100) { oEx(o); }

      // if ((Date.now() - thenStart) > 100)
      //   console.log('then timeout', Date.now() - firstThen,
      //     Date.now() - thenStart, cnt,
      //     'arrs:', thenArr.length, lastArr.length);

      thenStart = Date.now();
      if (!o) o = lastArr.shift();

      if (o) {
        thenState = true;
        setTimeout(function () {
          oEx(o);
          //o.fn.apply(o.this, o.args);
          thenRun();
        }, 0);
      } else thenState = false;
    };
  _.then = function (fn, args, that, last) {
    var arr = last ? lastArr : thenArr;
    arr.push({ fn: fn, args: args || [], this: that });
    if (!thenState) thenRun();
  };
  _.last = function (fn, args, that) { _.then(fn, args, that, true); };
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