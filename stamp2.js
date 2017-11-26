function Template(el, evalSelf=true) {
	if(!el instanceof Element
		&& !el instanceof DocumentFragment) return null;
	if(el.content) el = el.content;
	let rv = this;
	rv.element = el.cloneNode(true);
	rv.patterns = [];
	rv.repeats = [];
	let rxMus = /{{\s*([^ \t}]+)\s*}}/i;
	let rxRep = /^data-repeat-(\w+)$/;

	(function findElementPatterns(e, path=[]) {
		var patmatch=null;
		if(e.nodeName==='#text' && (patmatch=rxMus.exec(e.nodeValue))) rv.patterns.push({
			pattern: path.concat('nodeValue'), 
			replace: patmatch[0],
			expr: patmatch[1]
		});
		
		let isRepeat=false
		if(e.attributes) for(let a of e.attributes) {
			if(patmatch=rxMus.exec(a.value)) rv.patterns.push({
				pattern: path.concat('attributes', a.name, 'value'),
				replace: patmatch[0],
				expr: patmatch[1]
			});
			if(evalSelf && rxRep.test(a.name)) {
				isRepeat=true;
				rv.repeats.push({
					pattern: path.concat('attributes', a.name, 'value'), 
					value: a.value,
					template: new Template(e, false)
				});
			}
		}
		if(!isRepeat) for(let i=0;i<e.childNodes.length;i++) {
			let c = e.childNodes[i];
			findElementPatterns(c, path.concat('childNodes',i));
		}
	})(rv.element);
	if(rv.patterns.length==0) delete rv.patterns;
	if(rv.repeats.length==0) delete rv.repeats;
}

