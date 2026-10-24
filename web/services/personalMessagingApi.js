import api from './api';

// Global chat is always the signed-in identity. Delegated inboxes supply
// their own explicit X-Act-As header in AccountMessages.
const own = config => ({ ...config, __noActAs: true });
export default {
  get: (url, config) => api.get(url, own(config)),
  post: (url, body, config) => api.post(url, body, own(config)),
  patch: (url, body, config) => api.patch(url, body, own(config)),
  delete: (url, config) => api.delete(url, own(config)),
};
