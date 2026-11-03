// CloudFront Function (viewer request, runtime cloudfront-js-2.0).
// S3 ne sert pas « index.html » des sous-dossiers : /pokemon/pikachu doit
// devenir /pokemon/pikachu/index.html. Les fichiers (avec extension) passent.
// eslint-disable-next-line no-unused-vars
async function handler(event) {
  var request = event.request
  var uri = request.uri
  if (uri.endsWith('/')) {
    request.uri = uri + 'index.html'
  } else if (uri.split('/').pop().indexOf('.') === -1) {
    request.uri = uri + '/index.html'
  }
  return request
}
