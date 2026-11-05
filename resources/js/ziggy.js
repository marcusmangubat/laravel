const Ziggy = {
    url: 'http://localhost:8000',
    port: 8000,
    defaults: {},
    routes: {
        'boost.browser-logs': {
            uri: '_boost/browser-logs',
            methods: ['POST'],
        },
        login: { uri: 'login', methods: ['GET', 'HEAD'] },
        'login.submit': { uri: 'login', methods: ['POST'] },
        logout: { uri: 'logout', methods: ['POST'] },
        dashboard: { uri: 'dashboard', methods: ['GET', 'HEAD'] },
        'admin.email-settings': {
            uri: 'email-settings',
            methods: ['GET', 'HEAD'],
        },
        'admin.email-settings.update': {
            uri: 'email-settings',
            methods: ['PUT'],
        },
        'admin.email-settings.test': {
            uri: 'email-settings/test',
            methods: ['POST'],
        },
        'admin.dashboard': {
            uri: 'admin/dashboard',
            methods: ['GET', 'HEAD'],
            wheres: { id: '[0-9]+' },
        },
        'field.dashboard': {
            uri: 'field/dashboard',
            methods: ['GET', 'HEAD'],
            wheres: { id: '[0-9]+' },
        },
        'admin.notifications.read': {
            uri: 'admin/notifications/read',
            methods: ['POST'],
            wheres: { id: '[0-9]+' },
        },
        complaints: {
            uri: 'admin/complaints',
            methods: ['GET', 'HEAD'],
            wheres: { id: '[0-9]+' },
        },
        'complaints.store': {
            uri: 'admin/complaints',
            methods: ['POST'],
            wheres: { id: '[0-9]+' },
        },
        'storage.local': {
            uri: 'storage/{path}',
            methods: ['GET', 'HEAD'],
            wheres: { id: '[0-9]+', path: '.*' },
            parameters: ['path'],
        },
        'storage.local.upload': {
            uri: 'storage/{path}',
            methods: ['PUT'],
            wheres: { id: '[0-9]+', path: '.*' },
            parameters: ['path'],
        },
    },
};
if (typeof window !== 'undefined' && typeof window.Ziggy !== 'undefined') {
    Object.assign(Ziggy.routes, window.Ziggy.routes);
}
export { Ziggy };
