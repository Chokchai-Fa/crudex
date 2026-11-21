import React, { useEffect, useRef } from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import 'swagger-ui-dist/swagger-ui.css';

export default function ApiExplorer() {
  const url = useBaseUrl('/openapi.yaml');
  const container = useRef(null);
  useEffect(() => {
    let active = true;
    import('swagger-ui-dist/swagger-ui-bundle.js').then(({ default: SwaggerUI }) => {
      if (active) {
        SwaggerUI({
          domNode: container.current,
          url,
          validatorUrl: null,
          supportedSubmitMethods: [],
          filter: true,
          docExpansion: 'list',
        });
      }
    });
    return () => {
      active = false;
    };
  }, [url]);
  return (
    <>
      <p>
        <a href={url} download="openapi.yaml">
          Download the OpenAPI YAML
        </a>
      </p>
      <div
        ref={container}
        aria-label="OpenAPI operations"
        style={{ backgroundColor: 'white', colorScheme: 'light' }}
      />
    </>
  );
}
