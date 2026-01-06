export function el(tag, attrs={}, children=null){
  const node = document.createElement(tag);
  for(const [k,v] of Object.entries(attrs || {})){
    if(k === "class") node.className = v;
    else if(k === "style") node.setAttribute("style", v);
    else if(k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  if(children != null){
    const arr = Array.isArray(children) ? children : [children];
    for(const c of arr){
      if(c == null) continue;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
  }
  return node;
}
export function clear(node){
  while(node.firstChild) node.removeChild(node.firstChild);
}
