import { Logger } from "https://raw.githubusercontent.com/deepakshrma/deno_util/master/logger.ts";
import { serve} from "https://deno.land/std/http/server.ts"
import { Status } from 'https://deno.land/std@0.53.0/http/http_status.ts';
import { path } from "https://deno.land/x/compress@v0.4.1/deps.ts";

const fromRoot = (str: string) => path.normalize(Deno.cwd() + ( str.startsWith('/') ? str : '/' + str ) );

type RequestExtended = Request & { params: Record<string, string>, query: Record<string, string> }
const logger = new Logger();

//
// Mime types
//
const extToMime = new Map([
  [ 'html', "text/html; charset=utf-8" ],
  [ 'png', "image/svg+xml" ],
  [ 'svg', "image/svg+xml" ],
  [ 'json', "application/json; charset=utf-8" ]
]) 
//
// Routes
//
type RouteIntf = {
  name: string; // name of the route, just for tracking
  path: string; // path pattern for handler
  handler: (req: RequestExtended) => Promise<Response>; // handler to handle request
}

const routes: RouteIntf[] = [
  { name: "static", path: "/html/:fileName",             handler: staticFile},
  // { name: "menu",   path: "/api/v1/menu",             handler: menuHandler},
  // { name: "sheet",  path: "/api/v1/sheet/:sheetName", handler: sheetHandler},
  { name: "test",   path: "/test/:arg1/:arg2",           handler: testHandler },
  { name: "favicon",   path: "/favicon.png",             handler: pngHandler },
  { name: "main",   path: "/",                           handler: handler},
]

function routeNotFound(req: RequestExtended): Response {
  const body = JSON.stringify({ message: `${req.params.path}  NOT FOUND` })
  return new Response(body, {
    status: Status.NotFound,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  })
}

async function router(req: Request): Promise<Response> {
  logger.info("%s\t/%s:\t%s", new Date().toISOString() , req.method, req.url)
  const url = new URL(req.url);
  const fullPath = url.pathname;
  //
  // create query object
  //
  (req as RequestExtended).query = {};
  for(const p of url.searchParams) (req as RequestExtended).query[p[0]]=p[1];
  let found = false
  for (const route of routes) {
      if ( found ) break;
      const basePath = route.path.replace(/[:].*$/,'')
      // console.log( `${fullPath} should start with ${basePath}` )
      if ( fullPath.startsWith(basePath) ) {
          const routePathArr = route.path.split('/');
          const fullPathArr = fullPath.split('/');
          (req as RequestExtended).params = {path: basePath};
          let i = 0
          for( const p of routePathArr ) {
              if ( p.startsWith(':') ) {
                  (req as RequestExtended).params[p.replace(':', '')] = fullPathArr[i] ?? ''
              }
              i++
          }
          // Add any additional anonymous path elements 
          for ( let j = i ; j < fullPathArr.length; j++ )
              (req as RequestExtended).params[`p${j}`] = fullPathArr[j]
          found = true
          return await route.handler(req as RequestExtended)
      }
  }
  return routeNotFound(req as RequestExtended)
}

//
// Handlers
//
async function handler( req: RequestExtended) {
  // List the posts in the `blog` directory located at the root
  // of the repository.
  const posts = [];
  for await (const post of Deno.readDir(`./blog`)) {
    posts.push(post);
  }

  // Return JSON.
  return new Response(JSON.stringify(posts, null, 2), {
    headers: {
      "content-type": "application/json",
    },
  });
}

async function staticFile(req: RequestExtended, _filePath = '' ): Promise<Response> {
  // handle static files
  try {
      // const url = new URL(req.url);
      // const fileName = filePath.length > 0 ? filePath : JSON.stringify(url.pathname)
      const filePath = _filePath !== '' ? _filePath :  req.params.path + '/' + req.params.fileName
      console.debug(`Trying to read: '${fromRoot(filePath)}'`)
      const data = await Deno.readFile(fromRoot(filePath))
      const ext = filePath.split('.').pop()
      console.log(`Server sends file: ${req.params.fileName}`)
      return new Response(data, {
          status: Status.OK,
          headers: {
              "content-type": extToMime.get(ext ?? 'html')!,
          },
      });   
  } catch (err) {
      console.error(`staticFile handler got: ${err}`)
      return routeNotFound(req)
  }
}

async function pngHandler(req: RequestExtended ): Promise<Response> {
  return await staticFile(req, req.params.path)
} 

async function testHandler(req: RequestExtended): Promise<Response> {
  console.log("Method:", req.method);

  const url = new URL(req.url);
  const path = "\nfullPath:" +  url.pathname
  const params = JSON.stringify(req.params)
  const query =  JSON.stringify(req.query)
  // const params = "\nsearchParams:" + url.searchParams 
  const body = await req.text()
  let headers = '\nHeaders:'

  for (const [key, value] of req.headers.entries()) {
      headers += `\n\t${key}: ${value}`
  }
  return new Response(`CWD: '${Deno.cwd()}'` + path + '\nParams:' + params + '\nQuery:' + query + "\nURL:\n" + url.toString() + headers + `\nBody: '${body}'`);
}

serve(router);