/*
debug:
  1: node
  2: text
  4: attr
  8: eval
  16: repeat
  32: domMon
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
    Object.defineProperty(CTX.prototype, "ist", {
      get: function () { return ist; }
    });
    ist.model = model;
    var _ctx = _.oapply(new CTX(), ctx);

    ist.patterns = cls.defaultPatterns;
    ist.modules = cls.defaultModules;
    if (domMon) {
      ist._domMon = new domMon();
      ist.recalc = function () { ist._domMon.recalc(_ctx, ist) };
      ist.monLog = function () {
        console.log('watchlist', ist._domMon.watchList);
        console.log('rptList', ist._domMon.rptList);
      };
    }

    ist.exec = function () { return ist._exec(_temp, _ctx, _par); }

    ist._exec = function (e, ctx, par) {
      if (!(e = _.elCheck(e))) return;
      var e2 = e.cloneNode(true);
      _traverse(e2, ctx);
      if (ctx._removeParent) e2 = _.removeParent(e2);
      if (par = _.elCheck(par)) e2 = _.append(e2, par);
      return e2;
    }

    function _traverse(e, refctx) {
      if (refctx.debug & 1) console.log('node', _.nodePath(e));
      if (_.isComment(e)) return e;
      if ((e = _.elCheck(e)) === undefined) return;
      var ctx = _.oapply(new CTX(), refctx, e);

      if (_.isSingleTextChild(e)) {
        if (ctx.debug & 2) console.log('solo-text', e.nodeName, e.nodeValue);
        ist._patLoop(e, 'innerHTML', ctx, '');
        ctx._skipChildren = true;
      } else if (_.isNwText(e)) {
        if (ctx.debug & 2) console.log('text', e.nodeName, e.nodeValue);
        ist._patLoop(e, 'nodeValue', ctx, '', true);
      }

      if (e.attributes) for (var i = 0; i < e.attributes.length; i++) {
        var a = e.attributes[i];
        if (ctx.debug & 4) console.log('attr', a.name, a.value);
        ist._patLoop(a, 'value', ctx, a.name);
        _moduleLoop(a.name, a.value, e, ctx);
      }

      if (_.isfn(ctx._handleChildren)) ctx._handleChildren(e, ctx);
      else { // default child functionality, if not overridden
        if (ctx._elBody) {
          e.innerHTML = '';
          e.appendChild(ctx._elBody);
        }
        if (!ctx._skipChildren) {
          var ce = e.firstChild;
          while (ce) {
            ce = _traverse(ce, ctx);
            if (ce) ce = ce.nextSibling;
          }
        }
      }

      _.rapply(refctx, ctx);
      return e;
    }

    ist._patLoop = function (robj, rkey, ctx, name, nomon) {
      if (!nomon && ist._domMon) ist._domMon.patStart({
        robj: robj, rkey: rkey, ctx: ctx, name: name, pattern: robj[rkey]
      });
      for (var i = 0; i < ist.patterns.length; i++) {
        var pat = ist.patterns[i];
        robj[rkey] = robj[rkey].replace(pat.rx,
          pat.cb.bind(ist, ctx, name));
      }
      if (ist._domMon) ist._domMon.patEnd();
    }
    function _moduleLoop(key, value, e, ctx) {
      for (var i = 0; i < ist.modules.length; i++) {
        var mod = ist.modules[i],
          mkey = key.match(mod.rx);
        if (mkey && _.isfn(mod.cb)) mod.cb(mkey, value, e, ctx);
      }
    }
  };

  /****************************************************************************/
  // pattern/module functions
  var curlyPat = {
    rx: /{{\s*(.+?)\s*}}/ig,
    cb: function (ctx, name, all, spath) {
      var ist = this, path = curlyPat.expand(spath, ctx),
        val = curlyPat.eval.bind(ist)(path, ctx);
      val = curlyPat.event(path, val, ctx, name);
      if (val === null) val = all;
      return val;
    },
    eventRx: /^on-?/i,
    event: function (path, val, ctx, name) {
      var fn = val, e = ctx._node, ename = '';
      if (_.isfn(val) && curlyPat.eventRx.test(name)) {
        ename = name.replace(curlyPat.eventRx, '');
        val = '';
        e.attributes.removeNamedItem(name); delete e[name];
      } else if (name === 'value' && !e.valueBindApplied && _.elHasAttribute(e, 'value-bind')) {
        ename = 'change'
        e.valueBindApplied = true;
        fn = curlyPat.cbAutoChange;
      }
      if (ename) {
        if (ctx.debug & 8) console.log('bind', ename, e.nodeName);
        e.addEventListener(ename, fn.bind(e, ctx, path));
      }
      return val;
    },
    cbAutoChange: function (ctx, path) {
      var o = ctx, p = path.slice();
      while (p.length > 1) o = o[p.shift()];
      o[p[0]] = this.value;
      if (ctx.debug & 8) console.log('change-value-bind', this.value, o, p[0]);
    },

    rxPat: /[.\[\]]+/g,
    split: function (path) {
      if (_.isarr(path)) return path;
      else if (_.isstr(path)) return path.split(curlyPat.rxPat);
      else return [];
    },
    join: function (path) {
      if (_.isarr(path)) return path.join('.');
      else if (_.isstr(path)) return path;
      else return '';
    },
    expand: function (spath, ctx, join) {
      var path = curlyPat.split(spath);
      var p0 = path.shift(), o0 = ctx[p0];
      if (p0 !== 'model' && _.isstr(o0) && o0.indexOf('model') === 0)
        path = curlyPat.split(o0).concat(path);
      else path.unshift(p0);
      if (join === true) return curlyPat.join(path);
      return path;
    },
    eval: function (path, ctx) {
      if (_.isstr(path)) path = curlyPat.expand(path, ctx);
      var o = ctx, p = path.slice(), key, spath = curlyPat.join(path);
      while (key = p.shift()) {
        if (key in o) o = o[key];
        else if (domMon) o = domMon.arrayKey(o, key);
        if (typeof o === 'undefined') {
          if (ctx.debug & 8) console.warn('path not found', key, ' - ', spath);
          o = ''; break;
        }
      }
      if (ctx.debug & 8) console.log('eval', spath, o);
      if (this._domMon) this._domMon.patAdd(spath, o);
      return o;
    }
  };

  var domMon = function () {
    this.watchList = {};
    this.curpat = null;

    this.rptList = new DblMap();
  };
  { // domMon static props
    var dmProt = domMon.prototype;
    dmProt.recalc = function (ctx) {
      this.recalcPat(ctx);
      this.recalcRpt(ctx);
    };

    dmProt.patStart = function (obj) { this.curpat = obj; };
    dmProt.patEnd = function () {
      if (!this.curpat) return;
      this.curpat = null;
    };
    dmProt.patAdd = function (spath, value) {
      if (!this.curpat || spath.indexOf('model') !== 0
        || value instanceof Object) return;
      if (!(spath in this.watchList))
        this.watchList[spath] = { value: value, objs: [] };
      this.watchList[spath].objs.push(this.curpat);
    };
    dmProt.recalcPat = function (ctx) {
      var objs = [];
      for (var key in this.watchList) {
        var watch = this.watchList[key], newval = curlyPat.eval(key, ctx);
        if (watch.value !== newval) {
          if (ctx.debug & 32) console.log('calc', watch.value === newval, key, watch.value, newval, watch.objs.length);
          for (var j = watch.objs.length - 1; j >= 0; j--) {
            var ref = watch.objs[j];
            if (!_.isAttached(ref.robj)) watch.objs.splice(j, 1);
            else if (objs.indexOf(ref) < 0) objs.push(ref);
          }
          watch.value = newval;
        }
        if (!watch.objs.length) delete this.watchList[key];
      }
      for (var i = 0; i < objs.length; i++) {
        var o = objs[i];
        o.robj[o.rkey] = o.pattern;
        ctx.ist._patLoop(o.robj, o.rkey, o.ctx, o.name, true);
      }
    };

    dmProt.rptStart = function (spath, el, ctx, key) {
      if (ctx.debug & 32) console.log('rptStart', spath, el, ctx);
      if (!this.rptList.has(spath, el))
        this.rptList.set(spath, el, {
          ctx: ctx, key: key, arr: []
        });
    };
    dmProt.rptAdd = function (spath, el, item, i) {
      if (ctx.debug & 32) console.log('rptAdd', spath, el, item);
      var obj = this.rptList.get(spath, el);
      if (typeof i === 'number' && i >= 0 && i < obj.arr.length)
        obj.arr.splice(i, 0, item);
      else obj.arr.push(item);
    };
    dmProt.recalcRpt = function (ctx) {
      this.rptList.forEach(function (obj, spath, el) {
        var arr = curlyPat.eval(spath, obj.ctx);
        if (_.isarr(arr)) {
          var cnt = [0, 0, 0];
          // if (arr.length !== obj.arr.length)
          //   console.log('*****recalc RPT', spath, el, obj, arr);
          cnt[0] += domMon.arrayRemove(arr, obj.arr, obj.key, 'value');
          cnt[1] += domMon.arrayAdd(arr, obj.arr, obj.key, 'value', obj.ctx, el);
          cnt[2] += domMon.arrayOrder(arr, obj.arr, obj.key, 'value');
          if (cnt[0] + cnt[1] + cnt[2])
            console.log('*****recalc RECAP', JSON.stringify(cnt), spath, el, obj, arr);
        }
      });
    };
    domMon.arrayRemove = function (na, oa, nk, ok) {
      var nl = na.length, cnt = 0;
      if (!nk) while (oa.length > nl) {
        var obj = oa.pop();
        _.elRemove(obj.el);
        cnt++;
      } else {
        var nak = domMon.map(na, nk, true);
        for (var i = oa.length - 1; i >= 0; i--) { //reverse order, removals
          if (!(oa[i][ok] in nak)) { // if not in new keys, remove
            var obj = oa.splice(i, 1)[0];
            _.elRemove(obj.el);
            cnt++;
          }
        }
      }
      return cnt;
    };
    domMon.arrayAdd = function (na, oa, nk, ok, ctx, el) {
      if (!rptMod) return;
      var nl = na.length, cnt = 0;
      if (!nk) while (oa.length < nl) {
        rptMod.cbChildItem(na, oa.length, ctx, el);
        _.append(ctx._rfrag, el);
        cnt++;
        if (cnt > 5000) break;
      } else {
        var oak = domMon.map(oa, ok, true);
        var nak = domMon.map(na, nk);
        for (var i = 0; i < na.length; i++) {
          if (!(nak[i] in oak)) { // if not in old keys, add
            var insert = (i in oa);
            rptMod.cbChildItem(na, i, ctx, el);
            if (insert) _.before(ctx._rfrag, oa[i + 1].el);
            else _.append(ctx._rfrag, el);
            cnt++;
          }
        }
      }
      return cnt;
    };
    domMon.arrayOrder = function (na, oa, nk, ok) {
      var cnt = 0;
      if (!nk) return cnt;
      var oak = domMon.map(oa, ok, true);
      var nak = domMon.map(na, nk);
      for (var i = 0; i < na.length; i++) {
        var oi = oak[nak[i]];
        if (oi != i) {
          console.log('move el', nak[i], 'from', oi, 'to', i);
          cnt++;
        }
      }
      return cnt;
    };

    domMon.map = function (arr, key, makeObject) {
      var retval = makeObject ? {} : [];
      for (var i = 0; i < arr.length; i++) {
        var ck = domMon.cleanKey(arr[i][key]);
        if (makeObject && ck) retval[ck] = i;
        else if (!makeObject) retval.push(ck || i);
      }
      return retval;
    };

    domMon.cleanKey = function (key) {
      if (key && _.isstr(key)) return key.replace(/\W+/g, '_');
      else return key;
    }
    domMon.arrayKey = function (obj, key) {
      if (!_.isarr(obj) || key.indexOf('=') < 0) return obj;
      var s = key.split('='), i = s[0], k = s[1], v = s[2] || '', o = obj;
      if (i === '' && v === '') return o;
      var c = domMon.cleanKey;
      if (i in o && (v === '' || (k in o[i] && c(o[i][k]) == c(v)))) return o[i];
      for (i = 0; i < o.length; i++) {
        if ((k in o[i] && o[i][k] == v)) return o[i];
      }
      return undefined;
    };
    domMon.arrayPath = function (path, arr, i, kv) {
      kv = kv || {}; arr = arr || [];
      path = curlyPat.split(path);
      var key = path.pop(), weak = false;;
      if (!/^\d*=/.test(key)) {
        path.push(key); key = i; weak = true;
      } else {
        var k = kv.key = key.split('=')[1], o = arr[i] || {};
        if (k === '' || !(k in o) || !o[k]) {
          key = i; weak = true;
        } else {
          var val = kv.value = domMon.cleanKey(o[k]);
          key = [i, k, val].join('=');
        }
      }
      path.push(key);
      var retval = curlyPat.join(path);
      if (weak && ctx.debug & 32) console.log('array weak key', retval);
      return retval;
    };
  }

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

  var rptMod = {
    rx: /^data-repeat-([a-z]\w*)$/i,
    cb: function (mkey, value, e, ctx) {
      ctx._rpath = modelMod.cb(mkey, value, e, ctx);
      ctx._rkey = curlyPat.expand(ctx._rpath, ctx, true);
      ctx._rskey = curlyPat.join(ctx._rkey);
      ctx._rfrag = document.createDocumentFragment();
      if (!ctx._elBody) ctx._elBody = _.removeParent(e);
      ctx._handleChildren = rptMod.cbChildren;
    },
    cbChildren: function (el, ctx) {
      rptMod.cbChildLoop(el, ctx);
    },
    cbChildLoop: function (el, ctx, start, end) {
      var arr = curlyPat.eval(ctx._rkey, ctx), ist = ctx.ist, kv = {};
      if (domMon) domMon.arrayPath(ctx._rkey, [], '', kv);
      if (ist._domMon) ist._domMon.rptStart(ctx._rskey, el, ctx, kv.key);
      if (!_.isarr(arr)) return;
      start = start || 0; end = end || arr.length;
      if (ctx.debug & 16) console.log('repeat', start, end, ctx._rkey);
      for (var i = start; i < end; i++)
        rptMod.cbChildItem(arr, i, ctx, el);
      _.append(ctx._rfrag, el);
    },
    cbChildItem: function (arr, i, ctx, el) {
      var ist = ctx.ist, ipath, kv;
      if (!(i in arr)) return null;
      if (domMon) ipath = domMon.arrayPath(ctx._rkey, arr, i, kv = {});
      else ipath = ctx._rkey + '.' + i;
      ctx[ctx._rpath] = ipath;
      var newel = ist._exec(ctx._elBody, ctx, ctx._rfrag);
      ctx[ctx._rpath] = ctx._rkey;
      if (ist._domMon) ist._domMon.rptAdd(ctx._rskey, el, {
        key: kv.key, value: kv.value, ctx: ctx, el: newel
      }, i);
      return newel;
    }
  };

  cls.defaultPatterns = [curlyPat];
  cls.defaultModules = [modelMod, tmplMod, rptMod];

  if (typeof val !== 'undefined' && module && module.exports) {
    Templar.webServer = require('./0ws');
    module.exports = Templar;
  }
})();