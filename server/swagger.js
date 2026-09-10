//This file plays the role of Postman. It checkes the route files for API defintions and shows that on the Swagger UI for testing

const swaggerJsdoc = require("swagger-jsdoc");

// Reusable data-model schemas. Route JSDoc references these via
// $ref: '#/components/schemas/<Name>'. Every endpoint wraps its payload in the
// standard { success, message, data } envelope (ApiEnvelope below).
const schemas = {
  ApiEnvelope: {
    type: "object",
    properties: {
      success: { type: "boolean", example: true },
      message: { type: "string" },
    },
  },
  Pagination: {
    type: "object",
    properties: {
      page: { type: "integer", example: 1 },
      limit: { type: "integer", example: 20 },
      total: { type: "integer", example: 42 },
      totalPages: { type: "integer", example: 3 },
    },
  },
  Error: {
    type: "object",
    properties: {
      success: { type: "boolean", example: false },
      message: { type: "string" },
      error: {
        type: "object",
        properties: {
          code: {
            type: "string",
            enum: [
              "BAD_REQUEST",
              "UNAUTHORIZED",
              "FORBIDDEN",
              "NOT_FOUND",
              "CONFLICT",
              "VALIDATION_ERROR",
              "INTERNAL_SERVER_ERROR",
            ],
          },
          details: { type: "string", nullable: true },
        },
      },
    },
  },

  AdopterProfile: {
    type: "object",
    properties: {
      userID: { type: "integer" },
      avatarSeed: { type: "string", maxLength: 64 },
      adopterName: { type: "string" },
      adopterDOB: { type: "string", format: "date", nullable: true },
      adopterSex: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      adopterRiskFlag: { type: "boolean" },
      preQualifyFlag: { type: "boolean" },
      adopterPhone: { type: "string", nullable: true },
      housingType: {
        type: "string",
        enum: ["Apartment", "House", "Other"],
        nullable: true,
      },
      ownsOrRents: {
        type: "string",
        enum: ["Owns", "Rents"],
        nullable: true,
      },
      landlordContact: { type: "string", nullable: true },
      householdSize: { type: "integer", nullable: true },
      numChildren: { type: "integer", nullable: true },
      employmentStatus: {
        type: "string",
        enum: ["Unemployed", "Student", "Self_employed", "Employed"],
        nullable: true,
      },
      activityLevel: {
        type: "string",
        enum: ["Sedentary", "Medium", "Active"],
        nullable: true,
      },
      yardAvailable: { type: "boolean" },
      petExperience: {
        type: "string",
        enum: ["No", "Little", "Some", "Very"],
        nullable: true,
      },
      currentPets: { type: "integer" },
      preferredBreedID: { type: "integer", nullable: true },
      preferredAgeRange: {
        type: "string",
        enum: ["Young", "Adult", "Old"],
        nullable: true,
      },
      preferredSize: {
        type: "string",
        enum: ["Small", "Medium", "Large"],
        nullable: true,
      },
      openToSpecialNeeds: { type: "boolean" },
      adopterType: {
        type: "string",
        enum: ["Fosterer", "Owner"],
        nullable: true,
      },
      emailVerified: { type: "boolean" },
      lastLoginAt: { type: "string", format: "date-time", nullable: true },
      accountStatus: {
        type: "string",
        enum: ["Active", "Banned", "Deactivated"],
        nullable: true,
      },
    },
  },
  AdopterProfileUpdate: {
    type: "object",
    description:
      "Partial update — send only the fields to change. adopterEmail, adopterPassword, adopterRiskFlag, preQualifyFlag and accountStatus are rejected with 400. NOT-NULL columns cannot be set to null.",
    properties: {
      avatarSeed: { type: "string", maxLength: 64 },
      adopterName: { type: "string", maxLength: 45 },
      adopterDOB: { type: "string", format: "date", nullable: true },
      adopterSex: { type: "string", maxLength: 1, nullable: true },
      adopterPhone: { type: "string", maxLength: 20, nullable: true },
      housingType: { type: "string", enum: ["Apartment", "House", "Other"], nullable: true },
      ownsOrRents: { type: "string", enum: ["Owns", "Rents"], nullable: true },
      landlordContact: { type: "string", maxLength: 20, nullable: true },
      householdSize: { type: "integer", minimum: 0, nullable: true },
      numChildren: { type: "integer", minimum: 0, nullable: true },
      employmentStatus: {
        type: "string",
        enum: ["Unemployed", "Student", "Self_employed", "Employed"],
        nullable: true,
      },
      activityLevel: { type: "string", enum: ["Sedentary", "Medium", "Active"], nullable: true },
      yardAvailable: { type: "boolean" },
      petExperience: { type: "string", enum: ["No", "Little", "Some", "Very"], nullable: true },
      currentPets: { type: "integer", minimum: 0 },
      preferredBreedID: { type: "integer", nullable: true },
      preferredAgeRange: { type: "string", enum: ["Young", "Adult", "Old"], nullable: true },
      preferredSize: { type: "string", enum: ["Small", "Medium", "Large"], nullable: true },
      openToSpecialNeeds: { type: "boolean" },
      adopterType: { type: "string", enum: ["Fosterer", "Owner"], nullable: true },
    },
  },

  GovernmentIdRecord: {
    type: "object",
    properties: {
      governmentIDID: { type: "integer" },
      userID: { type: "integer" },
      userType: { type: "string", example: "Adopter" },
      idType: { type: "string", example: "Passport" },
      idNumber: {
        type: "string",
        description: "Masked — only the last 4 characters are returned",
        example: "*****6789",
      },
      verificationStatus: {
        type: "string",
        enum: ["Pending", "Verified", "Rejected"],
      },
      documentURL: {
        type: "string",
        nullable: true,
        description: "Object path within the private government-ids bucket",
      },
    },
  },

  AdoptionApplication: {
    type: "object",
    properties: {
      applicationID: { type: "integer" },
      petID: { type: "integer" },
      adopterID: { type: "integer" },
      shelterID: { type: "integer" },
      staffID: { type: "integer", nullable: true },
      applicationStatus: {
        type: "string",
        enum: ["Pending", "Accepted", "Rejected", "Withdrawn"],
      },
      applicationType: { type: "string", enum: ["Adopt", "Foster"] },
      shelterMessage: { type: "string", nullable: true },
      paymentStatus: { type: "string", enum: ["Paid"] },
      amountPaid: { type: "number", example: 15 },
      createdAt: { type: "string", format: "date-time" },
    },
  },
  AdoptionApplicationDetail: {
    allOf: [
      { $ref: "#/components/schemas/AdoptionApplication" },
      {
        type: "object",
        properties: {
          pet: {
            type: "object",
            properties: { petName: { type: "string" } },
          },
          shelter: {
            type: "object",
            properties: { shelterName: { type: "string" } },
          },
        },
      },
    ],
  },
  // Richer shape returned by GET /adoption-applications/:id only — for the
  // Applications section's detail slide-over.
  AdoptionApplicationFullDetail: {
    allOf: [
      { $ref: "#/components/schemas/AdoptionApplication" },
      {
        type: "object",
        properties: {
          applicationCode: { type: "string", example: "APP-00123" },
          staffRemark: { type: "string", nullable: true },
          assignedStaffName: { type: "string", nullable: true },
          pet: {
            type: "object",
            properties: {
              petName: { type: "string" },
              petPhoto: { type: "string", nullable: true },
              breedName: { type: "string" },
              speciesName: { type: "string" },
            },
          },
          shelter: {
            type: "object",
            properties: { shelterName: { type: "string" } },
          },
        },
      },
    ],
  },
  AdoptionApplicationListItem: {
    type: "object",
    properties: {
      applicationID: { type: "integer" },
      petID: { type: "integer" },
      shelterID: { type: "integer" },
      applicationStatus: {
        type: "string",
        enum: ["Pending", "Accepted", "Rejected", "Withdrawn"],
      },
      createdAt: { type: "string", format: "date-time" },
      pet: {
        type: "object",
        properties: {
          petName: { type: "string" },
          petPhoto: { type: "string", nullable: true },
          breed: {
            type: "object",
            properties: { breedName: { type: "string" } },
          },
        },
      },
      shelter: {
        type: "object",
        properties: { shelterName: { type: "string" } },
      },
    },
  },

  Visit: {
    type: "object",
    properties: {
      visitID: { type: "integer" },
      adopterID: { type: "integer" },
      petID: { type: "integer", nullable: true },
      staffID: { type: "integer", nullable: true },
      shelterID: { type: "integer" },
      visitTime: { type: "string", format: "date-time" },
      remarks: { type: "string", nullable: true },
      visitStatus: {
        type: "string",
        enum: ["Confirmed", "Cancelled", "Completed"],
        nullable: true,
      },
    },
  },
  VisitListItem: {
    allOf: [
      { $ref: "#/components/schemas/Visit" },
      {
        type: "object",
        properties: {
          shelter: {
            type: "object",
            properties: { shelterName: { type: "string" } },
          },
          pet: {
            type: "object",
            nullable: true,
            properties: { petName: { type: "string" } },
          },
        },
      },
    ],
  },

  AppointmentListItem: {
    type: "object",
    properties: {
      appointmentID: { type: "integer" },
      appointmentDate: { type: "string", format: "date-time" },
      appointmentReason: { type: "string" },
      pet: {
        type: "object",
        properties: {
          petID: { type: "integer" },
          petName: { type: "string" },
        },
      },
      shelter: {
        type: "object",
        properties: { shelterName: { type: "string" } },
      },
      vet: {
        type: "object",
        properties: { vetName: { type: "string" } },
      },
    },
  },

  AppointmentDetail: {
    type: "object",
    description:
      "Full record behind one Appointments row, for the detail slide-over.",
    properties: {
      appointmentID: { type: "integer" },
      appointmentCode: { type: "string", example: "APT-00123" },
      appointmentDate: { type: "string", format: "date-time" },
      appointmentReason: { type: "string" },
      pet: {
        type: "object",
        properties: {
          petID: { type: "integer" },
          petName: { type: "string" },
          petPhoto: { type: "string", nullable: true },
          breedName: { type: "string" },
          speciesName: { type: "string" },
        },
      },
      vetName: { type: "string", nullable: true },
      shelterName: { type: "string" },
      shelterAddress: { type: "string" },
      vaccinesAdministered: {
        type: "array",
        items: {
          type: "object",
          properties: {
            recordID: { type: "integer" },
            vaccineName: { type: "string" },
            dueDate: { type: "string", format: "date-time" },
          },
        },
      },
    },
  },

  PetDetail: {
    type: "object",
    properties: {
      petID: { type: "integer" },
      petName: { type: "string" },
      petAge: { type: "string", example: "2 yr" },
      petSex: { type: "string" },
      petPhoto: { type: "string" },
      petColor: { type: "string" },
      petHeight: { type: "number" },
      petWeight: { type: "number" },
      petDesc: { type: "string", nullable: true },
      breed: {
        type: "object",
        properties: {
          breedID: { type: "integer" },
          breedName: { type: "string" },
          speciesName: { type: "string" },
        },
      },
      shelter: {
        type: "object",
        properties: {
          shelterID: { type: "integer" },
          shelterName: { type: "string" },
          shelterAddress: { type: "string" },
        },
      },
      compatibleWithChildren: { type: "boolean" },
      compatibleWithPets: { type: "boolean" },
      specialNeeds: { type: "boolean" },
    },
  },
  AdoptedPet: {
    type: "object",
    description: "Same shape as a pet catalog card (see PetCard on GET /pets).",
    properties: {
      petID: { type: "integer" },
      petName: { type: "string" },
      petAge: { type: "string", example: "2 yr" },
      petSex: { type: "string" },
      petPhoto: { type: "string", nullable: true },
      breed: {
        type: "object",
        properties: {
          breedName: { type: "string" },
          speciesName: { type: "string" },
        },
      },
    },
  },
  VaccinationRecord: {
    type: "object",
    properties: {
      recordID: { type: "integer" },
      vaccineName: { type: "string" },
      administeredDate: { type: "string", format: "date-time" },
      dueDate: { type: "string", format: "date-time" },
      vetName: { type: "string", nullable: true },
    },
  },
  AdoptedPetDetail: {
    type: "object",
    description:
      "Consolidated detail for the My Pets side panel: basic details, intake, compatibility, health history, and the adoption record.",
    properties: {
      petID: { type: "integer" },
      petCode: { type: "string", example: "PE003794" },
      petName: { type: "string" },
      petPhoto: { type: "string", nullable: true },
      microchipID: { type: "string", nullable: true },
      petAge: { type: "string", example: "5 months" },
      petDOB: { type: "string", format: "date-time" },
      petSex: { type: "string" },
      petColor: { type: "string" },
      petSize: { type: "string", nullable: true, example: "Medium" },
      petHeight: { type: "number", description: "centimetres" },
      petWeight: { type: "number", description: "kilograms" },
      petBGroup: { type: "string", example: "DEA4" },
      petDesc: { type: "string", nullable: true },
      adoptionStatus: { type: "string", example: "adopted" },
      breed: {
        type: "object",
        properties: {
          breedName: { type: "string" },
          speciesName: { type: "string" },
        },
      },
      compatibility: {
        type: "object",
        properties: {
          children: { type: "boolean" },
          otherPets: { type: "boolean" },
          specialNeeds: { type: "boolean" },
        },
      },
      health: {
        type: "object",
        properties: {
          vaccinations: {
            type: "array",
            items: { $ref: "#/components/schemas/VaccinationRecord" },
          },
          appointments: {
            type: "array",
            items: {
              type: "object",
              properties: {
                appointmentID: { type: "integer" },
                appointmentDate: { type: "string", format: "date-time" },
                appointmentReason: { type: "string" },
                vetName: { type: "string", nullable: true },
                shelterName: { type: "string", nullable: true },
              },
            },
          },
        },
      },
      adoption: {
        type: "object",
        properties: {
          adoptedOn: { type: "string", format: "date-time" },
          shelterName: { type: "string" },
          shelterAddress: { type: "string" },
          yourMessage: { type: "string", nullable: true },
          staffRemark: { type: "string", nullable: true },
        },
      },
    },
  },
  Favorite: {
    type: "object",
    properties: {
      adopterID: { type: "integer" },
      petID: { type: "integer" },
    },
  },
};

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "PetPals API",
      version: "1.0.0",
      description: "REST API for the PetPals animal adoption management system",
    },
    servers: [{ url: "/api/v1", description: "API v1" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas,
      responses: {
        BadRequest: {
          description: "Invalid or missing input",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
        Unauthorized: {
          description: "No token, or token invalid/expired",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
        Forbidden: {
          description: "Valid token but the role is not permitted",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
        NotFound: {
          description: "Resource does not exist",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
        Conflict: {
          description: "Duplicate / conflicting request",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/routes/**/*.js"], //recurses into auth/ public/ adopter/ subfolders
};

module.exports = swaggerJsdoc(options);
