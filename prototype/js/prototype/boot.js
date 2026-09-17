/* PROTOTYPE LAYER — attaches the prototype to the application.
   The application exposes two neutral hooks on its router; nothing else in the
   application refers to environments, the Guide or simulators. */
R.hooks.gate = (app, parts) => {
  if (!Env.current()) {
    if (parts[0] !== 'welcome') {
      location.replace('#/welcome')
      return true
    }
    app.innerHTML = Welcome.html()
    return true
  }
  if (parts[0] === 'welcome') {
    if (S.user()) {
      location.replace('#/' + R.firstAllowed())
      return true
    }
    app.innerHTML = Welcome.html()
    return true
  }
  return false
}
R.hooks.afterRender = () => Review.sync()
