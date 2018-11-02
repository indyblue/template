/*
debug:
  1: node
  2: text
  4: attr
  8: eval
  16: repeat
*/
'use strict';
var Templar;
(function () {
  var _ = templarTools;
  /****************************************************************************/
  var cls = Templar = function (par, tmp, model, ctx) {
    var ist = this, _par = _.elCheck(par), _temp = _.elCheck(tmp);
    function CTX() { };
    Object.defineProperty(CTX.prototype, "model", {
      get: function () { return ist.model; }
    });
    ist.model = model;
    var _ctx = _.oapply(new CTX(), ctx, true);

    ist.patterns = cls.defaultPatterns;
    ist.modules = cls.defaultModules;
    if (domMon) {
      ist._domMon = new domMon();
      ist.recalc = function () { ist._domMon.recalc() };
    }

    ist.exec = function () { return _exec(_temp, _ctx, _par); }

    function _exec(e, ctx, par) {
      if (!(e = _.elCheck(e))) return;
      var e2 = e.cloneNode(true);
      _traverse(e2, ctx);
      if (ctx._removeParent) e2 = _.removeParent(e2);
      if (par = _.elCheck(par)) _.append(e2, par);
      return e2;
    }

    function _traverse(e, refctx) {
      if (refctx.debug & 1) console.log('node', _.nodePath(e));
      if (_.isComment(e)) return e;
      if ((e = _.elCheck(e)) === undefined) return;
      var ctx = _.oapply(new CTX(), refctx);

      if (_.isNwText(e)) e = _.isolateText(e); //might wrap text in span
      if (_.isNwText(e)) {
        if (ctx.debug & 2) console.log('text', e.nodeName, e.nodeValue);
        ctx._node = e.parentNode; //use parent: text nodes can split and stuff
        _patternLoop(ctx._node, 'textContent', ctx, '>');
        if (!ctx._node.firstChild) _.append(document.createTextNode(''), ctx._node);
        e = ctx._node.firstChild; //child text nodes will probably change
      }

      if (e.attributes) for (var i = 0; i < e.attributes.length; i++) {
        var a = e.attributes[i];
        if (ctx.debug & 4) console.log('attr', a.name, a.value);
        _patternLoop(a, 'value', ctx, a.name);
        _moduleLoop(a.name, a.value, e, ctx);
      }

      if (_.isfn(ctx._handleChildren)) ctx._handleChildren(e, ctx, _exec);
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

      _.rapply(refctx, ctx);
      return e;
    }

    function _patternLoop(robj, rkey, ctx, name) {
      var origVal = robj[rkey], calc = function (recalc) {
        if (!_.isfn(recalc)) robj[rkey] = origVal;
        for (var i = 0; i < ist.patterns.length; i++) {
          var pat = ist.patterns[i];
          robj[rkey] = robj[rkey].replace(pat.rx,
            pat.cb.bind(ist, ctx, name, recalc));
        }
      };
      calc(calc);
    }
    function _moduleLoop(key, value, e, ctx) {
      for (var i = 0; i < ist.modules.length; i++) {
        var mod = ist.modules[i],
          mkey = key.match(mod.rx);
        if (mkey && _.isfn(mod.cb)) mod.cb(mkey, value, e, ctx);
      }
    }
  };

  var clsp = cls.prototype;

  var domMon = function () {
    var that = this;
    that.watchList = {};
    that.recalc = function () {
      var cbs = [];
      for (var key in that.watchList) {
        var watch = that.watchList[key], newval = watch.check();
        if (1 || watch.val !== newval) {
          watch.val = newval;
          for (var j = watch.refresh.length - 1; j >= 0; j--) {
            var ref = watch.refresh[j];
            if (!ref.ctx._node || !_.isAttached(ref.ctx._node))
              watch.refresh.splice(j, 1);
            else if (cbs.indexOf(ref.cb) < 0) cbs.push(ref.cb);
          }
        }
        if (!watch.refresh.length) delete that.watchList[key];
      }
      for (var i = 0; i < cbs.length; i++) cbs[i]();
    };
    that.addPat = function (key, val, getval, recalc, ctx) {
      if (key.indexOf('model') !== 0 || !_.isfn(recalc)) return;
      if (!(key in that.watchList))
        that.watchList[key] = { val: val, check: getval, refresh: [] };
      that.watchList[key].refresh.push({ ctx: ctx, cb: recalc });
    };
  };

  /****************************************************************************/
  // pattern/module functions
  var curlyPat = {
    rx: /{{\s*(.+?)\s*}}/ig,
    cb: function (ctx, name, recalc, all, spath) {
      var ist = this, path = curlyPat.expand(spath, ctx),
        getval = function () { return curlyPat.eval(path, ctx); },
        val = getval();
      if (val !== null && ist._domMon)
        ist._domMon.addPat(curlyPat.join(path), val, getval, recalc, ctx);
      else if (val === null) val = all;
      return val;
    },

    rxPat: /[.\[\]]+/g,
    split: function (path) {
      if (_.isarr(path)) return path;
      else if (_.isstr(path)) return path.split(curlyPat.rxPat);
      else return [];
    },
    join: function (path, lastStrong) {
      if (_.isarr(path)) {
        if (!lastStrong) return path.join('.');
        var last = path.pop(), comp = curlyPat.getStrong(last);
        if (!comp) path.push(last);
        return [path.join('.'), comp];
      } else if (_.isstr(path)) return path;
      else return '';
    },
    expand: function (spath, ctx, join) {
      var path = curlyPat.split(spath);
      var p0 = path.shift(), o0 = ctx[p0];
      if (p0 !== 'model' && _.isstr(o0) && o0.indexOf('model') === 0)
        path = curlyPat.split(o0).concat(path);
      else path.unshift(p0);
      if (join) return curlyPat.join(path);
      return path;
    },
    eval: function (path, ctx) {
      if (_.isstr(path)) path = curlyPat.expand(path, ctx);
      var o = ctx, p = path.slice(), key, spath = curlyPat.join(path);
      while (key = p.shift()) {
        if (key in o) {
          if (_.isarr(o) && _.isobj(o[key]))
            console.warn('weak array, no key/value', key, '-', spath);
          o = o[key];
        } else o = curlyPat.strongIndex(o, key, spath);
        if (typeof o === 'undefined') {
          console.warn('path not found', key, ' - ', spath);
          o = ''; break;
        }
      }
      if (ctx.debug & 8) console.log('eval', spath, o);
      return o;
    },
    makeIndex: function (arr, i, key) {
    },
    rxStrongKey: /(\w*)=(\w*)=?(\w*)/,
    getStrong: function (key, type) {
      var k2 = key.match(curlyPat.rxStrongKey);
      if (!k2) return null;
      if (type) return k2[type];
      else return k2.slice(1, 4);
    },
    strongIndex: function (arr, compKey, spath) {
      if (!_.isarr(arr)) return undefined;
      var k2 = curlyPat.getStrong(compKey);
      if (!k2) return undefined;
      var idx = k2[0], key = k2[1], val = k2[2];
      if (!idx && !val) return arr; // if no idx or val just return array
      var o = arr[idx];
      if (!key || !val || (o && key in o && o[key] == val)) return o;
      if (_.isarr(arr)) for (var i = 0; i < arr.length; i++)
        if (arr[i][key] == val) {
          console.warn('array index [' + idx + '] wrong,'
            + 'using [' + i + '] instead', key, val, spath);
          return arr[i];
        }
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
      var elBody = _.elCheck(value);
      if (!elBody) console.warn('template', value, 'not found');
      else ctx._elBody = elBody;
    }
  };

  // evntMod - event handlers, incl binding for value/onchange
  //  - how to cooperate with curlyPat? ctx._onX vars? no braces?
  // if (name !== '>' && _.isfn(o) && _.isElement(e)) {
  //   e.attributes.removeNamedItem(name);
  //   delete e[name];
  //   e.addEventListener(name.replace(/^on-?/i, ''), o.bind(e, data, path));
  //   o = '';
  // }
  // if (name === 'value' && !e.valueBindApplied && _.elHasAttribute(e, 'value-bind')) {
  //   e.valueBindApplied = true;
  //   e.addEventListener('change', cbAutoChange.bind(e, data, path));
  // }

  /*
  recalc:
    - create new entries
    - delete entries
    - reorder entries
    - notes:
      - key in watchList would either 
        have to be pattern-matched 
        or exclude index to account for order change
    - method
      - store ordered id list for array as val
      - compare new id list with val, note diffs.
  */
  var rptMod = {
    rx: /^data-repeat-([a-z]\w*)$/i,
    cb: function (mkey, value, e, ctx) {
      ctx.rpath = modelMod.cb(mkey, value, e, ctx);
      if (!ctx._elBody) ctx._elBody = _.removeParent(e);
      ctx._handleChildren = rptMod.cbChildren;
    },
    cbChildren: function (el, ctx, fnExec) {
      rptMod.cbChildLoop(el, ctx, fnExec);
    },
    cbChildLoop: function (el, ctx, fnExec, start, end) {
      var rk = ctx.rpath, rk2 = curlyPat.expand(rk, ctx),
        rk3 = curlyPat.join(rk2, 1), rv = rk3[0],
        key = rk3[1] ? rk3[1][1] : null, arr = curlyPat.eval(rk2, ctx),
        start = start || 0; end = end || arr.length;
      if (ctx.debug & 16) console.log('repeat', start, end, rk3);
      var frag = document.createDocumentFragment();
      for (var i = start; i < end; i++) {
        if (!(i in arr)) break;
        ctx[rk] = rv + '.' + i;
        if (_.isobj(arr[i]) && key in arr[i])
          ctx[rk] += '=' + key + '=' + arr[i][key];
        fnExec(ctx._elBody, ctx, frag);
      }
      ctx[rk] = rv;
      _.append(frag, el);
    }
  };

  cls.defaultPatterns = [curlyPat];
  cls.defaultModules = [modelMod, tmplMod, rptMod];

  if (typeof val !== 'undefined' && module && module.exports) {
    Templar.webServer = require('./0ws');
    module.exports = Templar;
  }
})();