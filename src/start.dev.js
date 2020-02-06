import initServer from './server'

console.log('Initializing server.')

initServer({
  httpAuthMiddleware: false,
  socketAuthMiddleware: false
})
