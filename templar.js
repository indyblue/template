'use strict';
var Templar;
(function () {
  /****************************************************************************/
  var cls = Templar = function (par, tmp, model, ctx) {
    var ist = this, _par = elCheck(par), _temp = elCheck(tmp),
      _ctx = oapply({ model: model }, ctx, true);

    ist.patterns = cls.defaultPatterns;
    ist.modules = cls.defaultModules;
    ist.watchList = [];
    ist.recalc = function () {
      var cbs = [];
      for (var i in ist.watchList) {
        var watch = ist.watchList[i];
        if (watch.val !== watch.check()) {
          for (var j = 0; j < watch.refresh.length; j++) {
            if (cbs.indexOf(watch.refresh[j]) < 0) cbs.push(watch.refresh[j]);
          }
        }
      }
      for (var i = 0; i < cbs.length; i++) cbs[i]();
    };
    ist.exec = function () { return _exec(_temp, _ctx, _par); }

    function _exec(e, ctx, par) {
      if (!(e = elCheck(e))) return;
      var e2 = e.cloneNode(true);
      _traverse(e2, ctx);
      if (ctx._removeParent) e2 = removeParent(e2);
      if (par = elCheck(par)) append(e2, par);
      return e2;
    }

    function _traverse(e, refctx) {
      if (ist.debug) console.log('node', nodePath(e));
      if (isComment(e)) return e;
      if ((e = elCheck(e)) === undefined) return;
      var ctx = oapply({}, refctx);

      if (isNwText(e)) e = isolateText(e); //might wrap text in span
      if (isNwText(e)) {
        if (ist.debug) console.log('text', e.nodeName, e.nodeValue);
        var p = e.parentNode; //use parent: text nodes can split and stuff
        _patternLoop(p, 'textContent', p, ctx, '>');
        if (!p.firstChild) append(document.createTextNode(''), p);
        e = p.firstChild; //child nodes will probably change
      }

      if (e.attributes) for (var i = 0; i < e.attributes.length; i++) {
        var a = e.attributes[i];
        if (ist.debug) console.log('attr', a.name, a.value);
        _patternLoop(a, 'value', e, ctx, a.name);
        _moduleLoop(a.name, a.value, e, ctx);
      }

      if (isfn(ctx._handleChildren)) ctx._handleChildren(e, ctx, _exec);
      else { // default child functionality, if not overridden
        if (ctx._elBody) {
          e.innerHTML = '';
          e.appendChild(ctx._elBody);
        }
        var ce = e.firstChild;
        while (ce) {
          ce = _traverse(ce, ctx);
          if (ce) ce = ce.nextSibling;
        }
      }

      rapply(refctx, ctx);
      return e;
    }

    function _patternLoop(robj, rkey, e, ctx, name) {
      var origVal = robj[rkey], calc = function (recalc) {
        if (!isfn(recalc)) robj[rkey] = origVal;
        for (var i = 0; i < ist.patterns.length; i++) {
          var pat = ist.patterns[i];
          robj[rkey] = robj[rkey].replace(pat.rx,
            pat.cb.bind(ist, e, ctx, name, recalc));
        }
      };
      calc(calc);
    }
    function _moduleLoop(key, value, e, ctx) {
      for (var i = 0; i < ist.modules.length; i++) {
        var mod = ist.modules[i],
          mkey = key.match(mod.rx);
        if (mkey && isfn(mod.cb)) mod.cb(mkey, value, e, ctx);
      }
    }
  };

  var clsp = cls.prototype;

  /****************************************************************************/
  // pattern/module functions
  var curlyPat = {
    rx: /{{\s*(.+?)\s*}}/ig,
    cb: function (e, ctx, name, recalc, all, spath) {
      var ist = this, path = curlyPat.expand(spath, ctx),
        getval = function () { return curlyPat.eval(path, ctx); },
        val = getval();
      if (val !== null && path[0] === 'model' && isfn(recalc)) {
        var key = curlyPat.join(path), watch = ist.watchList;
        if (!(key in watch)) watch[key] = { val: val, check: getval, refresh: [] };
        watch[key].refresh.push(recalc);
      } else if (val === null) val = all;
      return val;
    },

    rxPat: /[.\[\]]+/g,
    split: function (path) {
      if (isarr(path)) return path;
      else if (isstr(path)) return path.split(curlyPat.rxPat);
      else return [];
    },
    join: function (path) {
      if (isarr(path)) return path.join('.');
      else if (isstr(path)) return path;
      else return '';
    },
    expand: function (spath, ctx, join) {
      var path = curlyPat.split(spath);
      var p0 = path.shift(), o0 = ctx[p0];
      if (p0 !== 'model' && isstr(o0) && o0.indexOf('model') === 0)
        path = curlyPat.split(o0).concat(path);
      else path.unshift(p0);
      if (join) return curlyPat.join(path);
      return path;
    },
    eval: function (path, ctx) {
      if (isstr(path)) path = curlyPat.expand(path, ctx);
      var o = ctx, p = path.slice();
      while (p.length && p[0] in o) o = o[p.shift()] || '';
      if (p.length) {
        console.warn('path not found:', curlyPat.join(path), ', at:', p[0]);
        o = null;
      }
      return o;
    }
  };
  var modelMod = {
    rx: /^data-model-([a-z]\w*)$/i,
    cb: function (mkey, value, e, ctx) {
      var key = mkey[1];
      value = value || ctx.lastModel || 'model';
      var path = curlyPat.expand(value, ctx, true);
      ctx[key] = path;
      ctx.lastModel = key;
      return key;
    }
  };
  var tmplMod = {
    rx: /^data-template$/i,
    cb: function (mkey, value, e, ctx) {
      var elBody = elCheck(value);
      if (!elBody) console.warn('template', value, 'not found');
      else ctx._elBody = elBody;
    }
  };
  // evntMod - event handlers, incl binding for value/onchange
  //  - how to cooperate with curlyPat? ctx._onX vars? no braces?
  // if (name !== '>' && isfn(o) && isElement(e)) {
  //   e.attributes.removeNamedItem(name);
  //   delete e[name];
  //   e.addEventListener(name.replace(/^on-?/i, ''), o.bind(e, data, path));
  //   o = '';
  // }
  // if (name === 'value' && !e.valueBindApplied && elHasAttribute(e, 'value-bind')) {
  //   e.valueBindApplied = true;
  //   e.addEventListener('change', cbAutoChange.bind(e, data, path));
  // }

  // key - how to get/use key instead of array index for updates?
  var rptMod = {
    rx: /^data-repeat-([a-z]\w*)$/i,
    cb: function (mkey, value, e, ctx) {
      ctx.rpath = modelMod.cb(mkey, value, e, ctx);
      if (!ctx._elBody) ctx._elBody = removeParent(e);
      ctx._handleChildren = rptMod.cbChildren;
    },
    cbChildren: function (el, ctx, fnExec) {
      rptMod.cbChildLoop(el, ctx, fnExec);
    },
    cbChildLoop: function (el, ctx, fnExec, start, end) {
      var rk = ctx.rpath, rv = curlyPat.expand(rk, ctx, 1),
        len = curlyPat.eval(rv + '.length', ctx);
      start = start || 0; end = end || len;
      console.log('repeat', start, end);
      var frag = document.createDocumentFragment();
      for (var i = start; i < end; i++) {
        ctx[rk] = rv + '.' + i;
        fnExec(ctx._elBody, ctx, frag);
      }
      ctx[rk] = rv;
      append(frag, el);
    }
  };

  cls.defaultPatterns = [curlyPat];
  cls.defaultModules = [modelMod, tmplMod, rptMod];
  /****************************************************************************/
  // ctx/state/model functions
  function oapply(obj, ref, all) {
    obj = obj || {};
    for (var k in ref) if (all || k[0] !== '_') obj[k] = ref[k];
    return obj;
  };
  function rapply(obj, ref) {
    if (!obj || !ref) return;
    for (var k in obj) if (k[0] === '$') ref[k] = obj[k];
  };

  /****************************************************************************/
  // element/type functions

  function isfn(val) { return typeof val === 'function'; }
  function isstr(val) { return typeof val === 'string'; }
  function isarr(val) { return typeof val !== 'undefined' && val instanceof Array; }
  function isElement(obj) { return obj instanceof Element; }
  function isText(obj) { return obj instanceof Text; }
  function isComment(obj) { return obj instanceof Comment; }
  function isDocFrag(obj) { return obj instanceof DocumentFragment; }

  function isNwText(obj) {
    if (isText(obj) && !isws(obj.wholeText)) return true;
  }
  function isws(str) { return /^\s*$/.test(str); }

  function isolateText(obj) {
    if (!isNwText(obj)) return obj;
    var first = obj, last = obj, par = obj.parentNode;
    while (isText(first.previousSibling)) first = first.previousSibling;
    while (isText(last.nextSibling)) last = last.nextSibling;
    if (!first.previousSibling && !last.nextSibling) {
      var par = obj.parentNode
      if (first === last) return par.firstChild;
      par.textContent = par.textContent;
      return par.firstChild;
    } else {
      var span = document.createElement('span');
      before(span, first);
      span.textContent = first.wholeText;
      getRange(first, last).deleteContents();
      return span;
    }
  }
  function getFragEnds(el) {
    if (!isDocFrag(el)) return;
    return [el.firstChild, el.lastChild];
  }
  function getRange(first, last) {
    if (!first) return;
    if (isarr(first)) { last = first[1]; first = first[0]; }
    var rng = document.createRange();
    rng.setStartBefore(first); rng.setEndAfter(last);
    return rng;
  }
  function elDel(el, dir) {
    if ((el = elCheck(el)) === undefined) return;
    var eParent = elCheck(el.parentNode);
    if (eParent === undefined) return;
    eParent.removeChild(el);
  }
  function before(eNew, eRef) {
    if ((eRef = elCheck(eRef)) === undefined) return;
    var eParent = elCheck(eRef.parentNode);
    if (eParent === undefined) return;
    var ends = getFragEnds(eNew);
    eParent.insertBefore(eNew, eRef);
    if (!ends) return eNew;
    else return getRange(ends);
  }
  function append(eNew, ePar) {
    if ((ePar = elCheck(ePar)) === undefined) return;
    var ends = getFragEnds(eNew);
    ePar.appendChild(eNew);
    if (!ends) return eNew;
    else return getRange(ends);
  }
  function elHasAttribute(obj, name) {
    if (!isElement(obj)) return false;
    if (isfn(obj.hasAttribute)) return false;
    return obj.hasAttribute(name);
  }
  function elCheck(el) {
    if (!el) return undefined;
    if (isstr(el)) el = document.querySelector(el);
    if (!isElement(el) && !isDocFrag(el) && !isText(el) && !isComment(el))
      return undefined;
    if (el.content) el = el.content;
    return el;
  }
  function removeParent(el) {
    var rng = getRange(el.firstChild, el.lastChild);
    return rng.extractContents();
  }
  function nodePath(el) {
    var retval = [];
    while (el) {
      retval.unshift(el.nodeName || el.tagName);
      el = el.parentNode;
    }
    return retval.join('->');
  }

  /****************************************************************************/

  if (typeof val !== 'undefined' && module && module.exports) {
    Templar.webServer = require('./0ws');
    module.exports = Templar;
  }
})();