function Template(el) {
	if(!el instanceof Element
		&& !el instanceof DocumentFragment) return null;
	if(el.content) el = el.content;
	let rv = this;
	rv.element = el.cloneNode(true);
	rv.patterns = [];
	rv.repeats = [];
	let rxMus = /{{\s*([^ \t}]+)\s*}}/ig;
	let rxRep = /^data-repeat-([^-]+)-?.*$/;
	let rxSplit = /[.\[\]]+/g;

	/*****************************************************************/
	// helper functions
	/*****************************************************************/
	function uMatches(rx, str, pat=-1) {
		if(!rx.global) {
			console.error('rx no global flag! recompiling...', rx.source)
			rx = new RegExp(rx.source, rx.flags+'g');
		}
		let am = [], m=rx.exec(''), i=0;
		while(i<100 && (m=rx.exec(str)) !== null) {
			am.push(pat<0?m:m[pat]);
			i++;
		}
		return am;
	}
	function oMatches(rx, str, [k,v]=[0,1], sv=true) {
		let m = uMatches(rx, str);
		if(m.length===0) return null;
		let obj = {};
		for(let i of m)
			if(!obj[i[k]]) obj[i[k]] = sv?i[v].split(rxSplit):i[v];
		return obj;
	}
	function newPat(path, str) {
		let m = oMatches(rxMus, str);
		if(m===null) return null;
		return { pattern: path, replace: m };
	}
	function pcon(path, v=null) {
		if(v===null) return path.concat('nodeValue');
		else return path.concat('attributes', v, 'value');
	}

	/*****************************************************************/
	// initialize pattern/repeat arrays
	/*****************************************************************/
	(function findElementPatterns(e, aPat, aRep, path=[]) {
		var np=null;
		//console.log(e.tagName||e.nodeName);
		if(e.nodeName==='#text' && (np=newPat(pcon(path), e.nodeValue))!==null)
			aPat.push(np);
		//if(e.nodeName==='#text') console.log('nodeValue', e.nodeValue);

		let tmpPath=path, tmpPat=aPat, tmpRep=aRep;
		if(e.attributes) for(let a of e.attributes) {
			//console.log('attr', a.name, a.value);
			if((np=newPat(pcon(path,a.name),a.value))!==null)
				aPat.push(np);
			if((np=rxRep.exec(a.name))!==null) {
				tmpPat=[]; tmpRep=[]; tmpPath=[];
				aRep.push({
					pattern: path.concat('attributes', a.name, 'value'),
					value: a.value,
					base: np[1],
					element: path,
					patterns: tmpPat,
					repeats: tmpRep
					//template: new Template(e, false)
				});
			}
		}
		for(let i=0;i<e.childNodes.length;i++) {
			let c = e.childNodes[i];
			findElementPatterns(c, tmpPat, tmpRep, tmpPath.concat('childNodes',i));
		}
	})(rv.element, rv.patterns, rv.repeats);

	/*****************************************************************/
	// worker methods
	/*****************************************************************/
	rv.new = function(e) {
		if(Array.isArray(e)) e = rv.eval(rv.element, e);
		return e.cloneNode(true);
	};
	rv.eval = function(path, data, k='', v='') {
		let apath = path;
		if(typeof apath==='string') apath = path.split(rxSplit);
		let o = data;
		for(let i=0;i<apath.length;i++){
			let p = apath[i];
			if(i==apath.length-3 && o instanceof Element && typeof v=='function') {
				let ename = apath[apath.length-2];
				o.attributes.removeNamedItem(ename);
				delete o[ename]
				return o.addEventListener(ename.substr(2), v.bind(o, k));
			} else if(i==apath.length-1 && typeof o[p]==='string' && k!==''){
				if(typeof v=='function') throw new Error("eval function - "
					+"should this be an event handler? " +p+' - '+apath.join('.'));
				else o[p] = o[p].replace(k, v);
			}
			else if(o[p]!==undefined) o = o[p];
			else throw new Error('eval - undefined '+p+' - '+path.join('.'));
		}
		return o;
	};
	rv.empty = function(el) {
		while(el.firstChild) el.removeChild(el.firstChild);
	};
	rv.exec = function(data, tmp, el) {
		if(tmp===undefined) tmp = rv;
		if(el===undefined) el = tmp.element;
		let newe = rv.new(el);
		//console.log(tmp);
		for(let pat of tmp.patterns) {
			for(let k in pat.replace) {
				let v = rv.eval(pat.replace[k], data);
				//console.log(k, v);
				if(typeof v==='function') k = data;
				rv.eval(pat.pattern, newe, k, v);
			}
		}
		for(let rep of tmp.repeats) {
			let reps = [];
			let rdata = rv.eval(rep.value, data);
			let rel = rv.eval(rep.element, newe);
			rdata.forEach((d,i)=> {
				let o = {[rep.base]:d, '^':data, '^i':i, '^v':rep.value };
				//console.log(rep.element, rep.value, o);
				reps.push(rv.exec(o, rep, rel));
			});
			rv.empty(rel);
			//console.log(reps.map(x=> x.childNodes));
			rv.append(rel, reps, true);
		}
		return newe;
	};
	rv.append = function(pe, els, children=false){
		if(!Array.isArray(els)) els = [els];
		for(let e of els){
			if(children) while(e.firstChild) {
				pe.appendChild(e.firstChild);
			} else pe.appendChild(e);
		}
	}
}

