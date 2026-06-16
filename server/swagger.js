//This file plays the role of Postman. It checkes the route files for API defintions and shows that on the Swagger UI for testing

const swaggerJsdoc = require("swagger-jsdoc");

//swagger-jsdoc options
const options = {
  definition: {
    //base information about your API that appears at the top of the Swagger UI
    openapi: "3.0.0",
    info: {
      //information about the API
      title: "PetPals API",
      version: "1.0.0",
      description: "REST API for the PetPals animal adoption management system",
    },
    servers: [
      //the servers that the API is hosted on
      {
        url: "/api/v1",
        description: "API v1",
      },
    ],
    components: {
      //components that are used in the API
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }], //security schemes that are used in the API
  },
  apis: ["./src/routes/*.js"], //the routes that are used in the API
};

module.exports = swaggerJsdoc(options);
