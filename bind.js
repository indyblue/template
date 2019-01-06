// var DateBind = bindProt(Date);
// var ArrayBind = bindProt(Array);

function BindProp(t, o, i, parents) {
  console.log('prop', parents.join('.'), i);
  // if (typeof o[i] === 'object') {
  //   var myBind = Bind;
  //   if (o[i] instanceof Date) myBind = DateBind;
  //   else if (o[i] instanceof Array) myBind = ArrayBind;
  //   o[i] = new myBind(o[i], parents.concat([i]));
  // }
  if (typeof o[i] === 'object') o[i] = new myBind(o[i], parents.concat([i]));

  Object.defineProperty(t, i, {
    get: function () {
      var val = o[i];
      console.log('get', parents.join('.') + '.' + i, ' -> ', val);
      return val;
    },
    set: function (val) {
      var oldVal = o[i];
      console.log('set', parents.join('.') + '.' + i, '=', oldVal, ' -> ', val);
      o[i] = val;
    },
    configurable: true, enumerable: true
  });
}

function Bind(orig, parents) {
  var t = this, e = {}, raw = Object.create(orig);
  Object.defineProperty(t, '__e__', { get: function () { return e; } });
  Object.defineProperty(t, '__o__', { get: function () { return raw; } });
  if (!parents) parents = ['root'];
  console.log('bind', parents.join('.'), raw);
  for (var i in orig) {
    raw[i] = orig[i];
    BindProp(t, raw, i, parents);
  }
  return t;
}
Bind.prototype.on = function (i, cb) {
  var t = this, a = t.__e__[i];
  if (!(a instanceof Array)) a = t.__e__[i] = [];
  if (a.indexOf(cb) < 0) a.push(cb);
}
Bind.prototype.off = function (i, cb) {
  var t = this, a = t.__e__[i], j;
  if (!(a instanceof Array)) a = t.__e__[i] = [];
  if ((j = a.indexOf(cb)) >= 0) a.splice(j, 1);
}

// function bindProt(Type, protListen) { // returns new class constructor
//   function BindCust(orig, parents) { //scoped for unique construction
//     var t = this;
//     Bind.call(t, orig, parents);
//   }
//   var bcp = BindCust.prototype = Object.create(Bind.prototype);
//   bcp.constructor = BindCust;
//   // need non-enumerable for native types like Date/Array.
//   var tp = Type.prototype, tpp = Object.getOwnPropertyNames(Type.prototype);
//   for (var i = 0; i < tpp.length; i++) {
//     var k = tpp[i];
//     console.log('mock prot', Type.name, k)
//     bcp[k] = function () {
//       var t = this;
//       console.log('prototype', k, arguments);
//       return tp[k].apply(t.__o__, arguments);
//     };
//   }
//   return BindCust;
// }


/* tests

var q = { a: 1, b: [1,2,3], c: 'asdf', d: { e: 1, f: 2 }, g: new Date() };
var r = new Bind(q);
r.b.push(4);

console.log(r.a, r.c, r.d.e, r.d.f);
r.c = 'qwer';
r.d.e = 41;
console.log(r.c, r.d.e);
JSON.stringify(r, null, 2)
*/