export {};

declare global {
    function route(
        name: string,
        params?: any[] | Record<string, any> | string | number,
        absolute?: boolean,
    ): string;
}
