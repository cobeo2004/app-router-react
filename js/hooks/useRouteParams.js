import { useParams, useLocation } from 'react-router-dom';
import { useRouteParam } from '../Router';

/**
 * @typedef {Object.<string, string|string[]|undefined>} RouteParams
 * @typedef {Object.<string, string>} QueryParams
 */

/**
 * Custom hook to get route parameters and query parameters
 * @returns {RouteParams & {query: QueryParams}} An object containing route parameters and query parameters
 * @property {RouteParams} - Route parameters
 * @property {QueryParams} query - Query parameters
 */
export function useRouteParams() {
  const params = useParams();
  const location = useLocation();
  const routeParam = useRouteParam();

  /** @type {RouteParams & { query: QueryParams }} */
  const result = {};

  if (routeParam) {
    // If we have a route parameter from useConvertRoute, use it
    const value = params['*'] || params[routeParam.slice(1)]; // Remove the '*' or ':' prefix
    const paramName = routeParam.slice(1);
    if (routeParam.startsWith('*')) {
      // It's a catch-all parameter
      result[paramName] = value ? value.split('/') : undefined;
    } else {
      // It's a regular parameter
      result[paramName] = value;
    }
  } else {
    // If we don't have a route parameter, process all params
    Object.entries(params).forEach(([key, value]) => {
      if (key === '*') {
        // Handle catch-all segments
        const segments = value ? value.split('/') : [];
        if (segments.length > 0) {
          result[key] = segments;
        } else {
          result[key] = undefined;
        }
      } else {
        // Handle dynamic segments
        result[key] = value;
      }
    });
  }

  // Parse query parameters
  result.query = Object.fromEntries(new URLSearchParams(location.search));

  return result;
}
