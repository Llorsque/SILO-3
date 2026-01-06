class Router{
  constructor(){
    this.routes = new Map();
    window.addEventListener("hashchange", () => this._render());
  }
  register(name, fn){ this.routes.set(name, fn); }
  go(name){
    const target = name || "home";
    if(location.hash.replace("#","") === target) this._render();
    else location.hash = target;
  }
  start(){
    if(!location.hash) location.hash = "home";
    this._render();
  }
  _render(){
    const key = location.hash.replace("#","") || "home";
    const fn = this.routes.get(key) || this.routes.get("home");
    if(fn) fn();
  }
}
export const router = new Router();
