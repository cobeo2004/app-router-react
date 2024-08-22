import {
    BrowserRouter,
    Routes as ReactRouterRoutes,
    Route,
} from "react-router-dom";
import React, { createContext, useContext } from "react";

/**
 * @typedef {Object} RouteInfo
 * @property {string} path
 * @property {React.ComponentType<any>} component
 * @property {React.ComponentType<any>} [layout]
 */

/**
 * @param {Record<string, any>} pages
 * @param {string} [customDirectory="app"]
 * @param {string} [customEntryPage="page"]
 * @returns {RouteInfo[]}
 */
function useConvertRoute(
    pages,
    customDirectory = "app",
    customEntryPage = "page"
) {
    const routes = [];
    const layouts = {};
    let parameter = undefined;

    /**
     * @param {string} path
     * @returns {string}
     */
    function normalizePath(path) {
        return "/" + path.split("/").filter(Boolean).join("/");
    }

    /**
     * @param {string} path
     * @returns {React.ComponentType<any> | undefined}
     */
    function getLayoutForPath(path) {
        // console.log(`Checking layout for path: ${path}`);
        const pathParts = path.split("/").filter(Boolean);
        let currentPath = "";

        for (let i = pathParts.length; i >= 0; i--) {
            currentPath = "/" + pathParts.slice(0, i).join("/");
            if (layouts[currentPath]) {
                console.log(`Found layout for ${path}: ${layouts[currentPath].name}`);
                return layouts[currentPath];
            }
        }

        // console.log(`No specific layout found for ${path}, using root layout`);
        return layouts[""] || undefined;
    }

    // First pass: identify all layouts
    Object.keys(pages).forEach((key) => {
        if (
            key.endsWith("layout.tsx") ||
            key.endsWith("layout.js") ||
            key.endsWith("layout.jsx")
        ) {
            let layoutPath = key
                .replace(`./${customDirectory}`, "")
                .replace(/\.(t|j)sx?$/, "")
                .replace(/layout$/, "");

            // Preserve group layouts by not removing parentheses
            layoutPath = normalizePath(layoutPath);

            if (!pages[key].default)
                throw new Error(`Layout in ${key} must be exported as default`);

            layouts[layoutPath] = pages[key].default;
            // console.log(`Registered layout for path: ${layoutPath}`);
        }
    });

    // Second pass: create routes
    Object.keys(pages).forEach((key) => {
        if (
            key.endsWith("layout.tsx") ||
            key.endsWith("layout.js") ||
            key.endsWith("layout.jsx") ||
            key.endsWith("loading.tsx") ||
            key.endsWith("loading.js") ||
            key.endsWith("loading.jsx")
        ) {
            return; // Skip layout files in this pass
        }

        let path = key
            .replace(`./${customDirectory}`, "")
            .replace(/\.(t|j)sx?$/, "")
            .replace(new RegExp(`\\/${customEntryPage}$`, "i"), "/")
            .replace(/\b[A-Z]/, (firstLetter) => firstLetter.toLowerCase())
            .replace(/\[(?:[.]{3})?(\w+?)\]/g, (_match, param) => {
                // Handle catch-all and optional catch-all segments
                if (_match.startsWith('[...')) {
                    parameter = `*${param.replace(/^\.\.\./, '')}`;
                    return  _match.startsWith('...?') ? '*' : '*'
                }
                return `:${param}`;
            });

            // console.log('parameter', parameter);

        // Normalize the path but keep group names for layout matching
        const layoutMatchPath = normalizePath(path);

        // Remove group names for the final route path
        path = path.replace(/\/\([^/]+\)/g, "");
        path = normalizePath(path);
        // console.log('path: ', path.split('/').find((value) => value));

        if (pages[key].default) {
            const layout = getLayoutForPath(layoutMatchPath);
            if(path.split('/').includes('*')) {
            routes.push({
                path,
                component: pages[key].default,
                layout: layout,
                parameter: parameter
            });
            } else {
                routes.push({
                    path,
                    component: pages[key].default,
                    layout: layout,
                });
            }
        } else {
            throw new Error(`${key} doesn't export a default React component`);
        }
    });

    // console.log("Layouts:", Object.keys(layouts));
    // routes.forEach((route) => {
    //     console.log(
    //         `Route: ${route.path}, Layout: ${route.layout?.name || "None"}`
    //     );
    // });

    return routes;
}

/**
 * @param {Object} props
 * @param {React.ComponentType<any>} [props.Layout]
 * @param {React.ComponentType<any>} props.Page
 */
function LayoutWrapper({ Layout, Page }) {
    return Layout ? (
        <Layout>
            <Page />
        </Layout>
    ) : (
        <Page />
    );
}

/**
 * @template {("vite" | "webpack")} T
 * @param {T} typeOfImport
 * @returns {Record<string, any>}
 */
function useGetPages(typeOfImport) {
    if (typeOfImport === "vite") {
        if (typeof import.meta !== "undefined") {
            // console.log("Using import.meta");
            const pages = import.meta.glob("./app/**/!(*.test.[jt]sx)*.([jt]s|[jt]sx)", {
                eager: true,
            });
            return pages;
        }
    }
    if (typeOfImport === "webpack") {
            // console.log("Using require.context");
            const ctx = require.context('./app', true, /^(?!.*\.test\.[jt]sx?$).*\.[jt]sx?$/);
            let pages = {};
            ctx.keys().forEach((key) => {
                pages[`./app/${key.split("./")[1]}`] = ctx(key);
        });
        return pages;
    }
    return {};
}

// Create a context for the route parameter
const RouteParamContext = createContext(undefined);

// New hook to get the route parameter
export function useRouteParam() {
    return useContext(RouteParamContext);
}

/**
 * @template {("vite" | "webpack")} T
 * @param {Object} props
 * @param {T} props.typeOfImport
 */
export default function FileBasedRoutes({ typeOfImport }) {
    let pages = useGetPages(typeOfImport);
    // console.log("Pages: ", pages);
    const routes = useConvertRoute(pages);
    // console.log(routes);
    const routeComponents = routes.map(
        ({ path, component: Component, layout: Layout, parameter }) => (
            <Route
                key={path}
                path={path}
                element={
                    <RouteParamContext.Provider value={parameter}>
                        <LayoutWrapper Layout={Layout} Page={Component} />
                    </RouteParamContext.Provider>
                }
            />
        )
    );

    const NotFoundComponent = routes.find(({ path }) => path === "/notFound")
        ?.component;

    return (
        <BrowserRouter>
            <ReactRouterRoutes>
                {routeComponents}
                <Route path="*" element={<NotFoundComponent />} />
            </ReactRouterRoutes>
        </BrowserRouter>
    );
}
