module.exports = {
  handbook: [
    'index',
    {
      type: 'category',
      label: 'Get started',
      items: ['product/workflows', 'getting-started/local-development', 'product/design'],
    },
    {
      type: 'category',
      label: 'API integration',
      items: ['integrations/school-api', 'reference/openapi', 'integrations/demo-gateway'],
    },
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'architecture/run-lifecycle',
        'architecture/cloud-services',
        'architecture/service-diagrams',
      ],
    },
    { type: 'category', label: 'Reference', items: ['reference/database'] },
  ],
};
