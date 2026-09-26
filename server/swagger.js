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
          adopter: {
            type: "object",
            properties: {
              adopterName: { type: "string" },
              adopterEmail: { type: "string" },
              adopterPhone: { type: "string", nullable: true },
              housingType: { type: "string", nullable: true },
              ownsOrRents: { type: "string", nullable: true },
              landlordContact: { type: "string", nullable: true },
              householdSize: { type: "integer", nullable: true },
              numChildren: { type: "integer", nullable: true },
              preQualifyFlag: { type: "boolean" },
            },
          },
          governmentIdStatus: {
            type: "string",
            enum: ["Pending", "Verified", "Rejected"],
            nullable: true,
            description: "Staff/Admin only — null for an Adopter viewing their own application, or if no government ID has been submitted yet. No idType/idNumber here; the full record lives in the dedicated ID Verification tab.",
          },
          canAssignStaff: {
            type: "boolean",
            description: "True only for the application's shelter manager (or Admin) while it's still Pending — gates PATCH /adoption-applications/{id}.",
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

  VisitDetail: {
    type: "object",
    description: "Full record behind one Visits row, for the detail slide-over.",
    properties: {
      visitID: { type: "integer" },
      visitTime: { type: "string", format: "date-time" },
      remarks: { type: "string", nullable: true },
      visitStatus: {
        type: "string",
        nullable: true,
        enum: ["Confirmed", "Cancelled", "Completed"],
      },
      canCancel: { type: "boolean" },
      pet: {
        type: "object",
        nullable: true,
        properties: {
          petName: { type: "string" },
          petPhoto: { type: "string", nullable: true },
          breedName: { type: "string" },
          speciesName: { type: "string" },
        },
      },
      shelterName: { type: "string" },
      shelterAddress: { type: "string" },
      assignedStaffName: { type: "string", nullable: true },
    },
  },
  // One row of the Staff/Admin shelter-wide visit queue (GET /visits) —
  // distinct from VisitListItem (an adopter's own visits), since staff are
  // managing visits booked by many different adopters.
  VisitQueueItem: {
    allOf: [
      { $ref: "#/components/schemas/Visit" },
      {
        type: "object",
        properties: {
          pet: {
            type: "object",
            nullable: true,
            properties: { petName: { type: "string" } },
          },
          adopter: {
            type: "object",
            properties: {
              adopterName: { type: "string" },
              user: {
                type: "object",
                properties: { userEmail: { type: "string" } },
              },
            },
          },
          staff: {
            type: "object",
            nullable: true,
            description: "null until a staff member Confirms or Completes the visit.",
            properties: { staffName: { type: "string" } },
          },
        },
      },
    ],
  },

  Event: {
    type: "object",
    properties: {
      eventID: { type: "integer" },
      eventName: { type: "string", maxLength: 45 },
      eventDate: { type: "string", format: "date-time" },
      eventDesc: { type: "string", maxLength: 300 },
      eventCategory: {
        type: "string",
        enum: [
          "Adoption_Event",
          "Fundraiser",
          "Volunteer_Orientation",
          "Vaccination_Clinic",
          "Community_Outreach",
          "Workshop",
          "Donation_Drive",
          "Other",
        ],
      },
    },
  },
  EventListItem: {
    allOf: [
      { $ref: "#/components/schemas/Event" },
      {
        type: "object",
        properties: {
          shelter: {
            type: "object",
            properties: {
              shelterID: { type: "integer" },
              shelterName: { type: "string" },
            },
          },
        },
      },
    ],
  },
  EventDetail: {
    allOf: [
      { $ref: "#/components/schemas/Event" },
      {
        type: "object",
        properties: {
          shelter: {
            type: "object",
            properties: {
              shelterID: { type: "integer" },
              shelterName: { type: "string" },
              shelterAddress: { type: "string" },
            },
          },
        },
      },
    ],
  },

  AppointmentQueueItem: {
    type: "object",
    properties: {
      appointmentID: { type: "integer" },
      appointmentDate: { type: "string", format: "date-time" },
      appointmentReason: { type: "string", maxLength: 300 },
      status: {
        type: "string",
        enum: ["Scheduled", "Completed", "Cancelled"],
      },
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
      vetName: { type: "string" },
    },
  },
  AppointmentDetail: {
    allOf: [
      { $ref: "#/components/schemas/AppointmentQueueItem" },
      {
        type: "object",
        properties: {
          appointmentCode: { type: "string", example: "APT-00123" },
          shelterName: { type: "string" },
          vetID: { type: "integer" },
          staffID: { type: "integer", nullable: true },
          volunteerID: { type: "integer", nullable: true },
          staffName: { type: "string", nullable: true },
          volunteerName: { type: "string", nullable: true },
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
          adopter: {
            type: "object",
            nullable: true,
            properties: {
              adopterName: { type: "string" },
              adopterPhone: { type: "string", nullable: true },
              adopterEmail: { type: "string" },
              address: { type: "string" },
            },
          },
        },
      },
    ],
  },

  GovernmentIdQueueItem: {
    type: "object",
    description:
      "One row in the ID Verification queue. Scoped to Adopters + Volunteers only.",
    properties: {
      governmentIDID: { type: "integer" },
      userID: { type: "integer" },
      userType: { type: "string", enum: ["Adopter", "Volunteer"] },
      personName: { type: "string" },
      personEmail: { type: "string", nullable: true },
      personAvatarSeed: {
        type: "string",
        nullable: true,
        description: "Passed to the DiceBear Avatar component client-side, same as every other role's avatarSeed.",
      },
      idType: { type: "string" },
      verificationStatus: {
        type: "string",
        enum: ["Pending", "Verified", "Rejected"],
      },
    },
  },
  GovernmentIdDetail: {
    allOf: [
      { $ref: "#/components/schemas/GovernmentIdQueueItem" },
      {
        type: "object",
        properties: {
          idNumber: {
            type: "string",
            description:
              "Unmasked, unlike every other place GovernmentID is exposed (e.g. the Applications detail panel) — this is the dedicated, authorized verification workflow.",
          },
          documentURL: {
            type: "string",
            nullable: true,
            description:
              "Short-lived (5 min) signed URL for the document image, generated fresh on every read — never cached or persisted.",
          },
        },
      },
    ],
  },

  HealthPassport: {
    type: "object",
    description:
      "Read-only aggregate for the Health Passport page — pet is the same shape as GET /staff/me/pets/:id's data.",
    properties: {
      pet: { type: "object" },
      healthRecords: {
        type: "array",
        items: {
          type: "object",
          properties: {
            recordID: { type: "integer" },
            createdAt: { type: "string", format: "date-time" },
            recordDesc: { type: "string", maxLength: 500 },
            vetName: { type: "string", nullable: true },
            shelterName: { type: "string", nullable: true },
          },
        },
      },
      vaccinations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            recordID: { type: "integer" },
            vaccineName: { type: "string" },
            administeredDate: { type: "string", format: "date-time" },
            dueDate: { type: "string", format: "date-time" },
            status: {
              type: "string",
              enum: ["Overdue", "Due Soon", "Up to Date"],
            },
          },
        },
      },
      transferHistory: {
        type: "array",
        items: {
          type: "object",
          properties: {
            recordID: { type: "integer" },
            transferDate: { type: "string", format: "date-time" },
            transferReason: { type: "string", maxLength: 300 },
            transferStatus: {
              type: "string",
              enum: ["In_Progress", "Completed", "Rejected", "Cancelled"],
            },
            fromShelterName: { type: "string" },
            toShelterName: { type: "string" },
            fromStaffName: { type: "string", nullable: true },
            toStaffName: { type: "string", nullable: true },
          },
        },
      },
    },
  },

  TransferQueueItem: {
    type: "object",
    properties: {
      recordID: { type: "integer" },
      petID: { type: "integer" },
      transferDate: { type: "string", format: "date-time" },
      fromShelterID: { type: "integer" },
      toShelterID: { type: "integer" },
      transferStatus: {
        type: "string",
        enum: ["In_Progress", "Completed", "Rejected", "Cancelled"],
      },
      transferReason: { type: "string", maxLength: 300 },
      pet: {
        type: "object",
        properties: {
          petName: { type: "string" },
          petPhoto: { type: "string", nullable: true },
          breedName: { type: "string" },
          speciesName: { type: "string" },
        },
      },
      fromShelter: {
        type: "object",
        properties: { shelterName: { type: "string" } },
      },
      toShelter: {
        type: "object",
        properties: { shelterName: { type: "string" } },
      },
    },
  },
  Task: {
    type: "object",
    properties: {
      taskID: { type: "integer" },
      taskName: {
        type: "string",
        enum: [
          "Animal_Care",
          "Vet_Assistance",
          "Cleaning",
          "Feeding",
          "Events",
          "Admin",
          "Other",
        ],
      },
      taskDesc: { type: "string", maxLength: 300 },
      taskDate: { type: "string", format: "date-time", nullable: true },
      taskDue: { type: "string", format: "date-time", nullable: true },
      taskStatus: {
        type: "string",
        enum: ["In_progress", "Completed", "Cancelled"],
      },
      status: {
        type: "string",
        enum: ["In_progress", "Overdue", "Completed", "Cancelled"],
        description: "taskStatus, or Overdue for an In_progress task past due",
      },
      staffName: { type: "string", nullable: true },
      volunteers: {
        type: "array",
        items: {
          type: "object",
          properties: {
            volunteerID: { type: "integer" },
            volunteerName: { type: "string" },
          },
        },
      },
    },
  },
  ShelterStaffMember: {
    type: "object",
    properties: {
      userID: { type: "integer" },
      avatarSeed: { type: "string", description: "DiceBear seed — the avatar is generated client-side." },
      staffName: { type: "string" },
      staffEmail: { type: "string" },
      staffPhone: { type: "string", nullable: true },
      staffDOB: { type: "string", format: "date", nullable: true },
      staffSex: { type: "string", enum: ["M", "F"], nullable: true },
      staffDesignation: {
        type: "string",
        enum: ["Manager", "Senior", "Associate"],
        nullable: true,
      },
      staffDOJ: { type: "string", format: "date-time", nullable: true, description: "Date of Joining — stamped on first approval." },
      staffDOS: { type: "string", format: "date-time", nullable: true, description: "Date of Separation — stamped on deactivation, cleared on reactivation." },
      accountStatus: { type: "string", enum: ["Pending", "Active", "Deactivated"] },
    },
  },
  ShelterVet: {
    type: "object",
    properties: {
      userID: { type: "integer" },
      avatarSeed: { type: "string", description: "DiceBear seed — the avatar is generated client-side." },
      vetName: { type: "string" },
      vetEmail: { type: "string" },
      vetPhone: { type: "string", nullable: true },
      addressLine1: { type: "string" },
      addressLine2: { type: "string", nullable: true },
      city: { type: "string" },
      state: { type: "string" },
      zip: { type: "string" },
      country: { type: "string" },
      vetDOB: { type: "string", format: "date", nullable: true },
      vetSex: { type: "string", enum: ["M", "F"], nullable: true },
      createdAt: { type: "string", format: "date-time", description: "When the vet registered." },
      accountStatus: { type: "string", enum: ["Pending", "Active", "Deactivated"] },
    },
  },
  VolunteerListItem: {
    type: "object",
    properties: {
      userID: { type: "integer" },
      volunteerName: { type: "string" },
      volunteerPhone: { type: "string", nullable: true },
      volunteerEmail: { type: "string" },
      accountStatus: {
        type: "string",
        enum: ["Pending", "Active", "Banned", "Deactivated"],
      },
    },
  },
  VolunteerDetail: {
    type: "object",
    properties: {
      userID: { type: "integer" },
      volunteerCode: { type: "string", example: "VOL-00012" },
      avatarSeed: { type: "string" },
      volunteerName: { type: "string" },
      addressLine1: { type: "string" },
      addressLine2: { type: "string", nullable: true },
      city: { type: "string" },
      state: { type: "string" },
      zip: { type: "string" },
      country: { type: "string" },
      volunteerPhone: { type: "string", nullable: true },
      volunteerDOB: { type: "string", format: "date-time", nullable: true },
      volunteerSex: { type: "string", nullable: true },
      volunteerSchedule: { type: "string", nullable: true },
      shelterID: { type: "integer", nullable: true },
      shelterName: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      accountStatus: {
        type: "string",
        enum: ["Pending", "Active", "Banned", "Deactivated"],
      },
      volunteerEmail: { type: "string" },
      governmentID: {
        type: "object",
        nullable: true,
        properties: {
          idType: { type: "string" },
          idNumber: { type: "string" },
        },
      },
    },
  },
  TransferStaffOption: {
    type: "object",
    nullable: true,
    properties: {
      staffID: { type: "integer" },
      staffName: { type: "string" },
    },
  },
  TransferDetail: {
    allOf: [
      { $ref: "#/components/schemas/TransferQueueItem" },
      {
        type: "object",
        properties: {
          fromShelterStaff: { type: "integer", nullable: true },
          toShelterStaff: { type: "integer", nullable: true },
          fromStaff: {
            type: "object",
            nullable: true,
            properties: { staffName: { type: "string" } },
          },
          toStaff: {
            type: "object",
            nullable: true,
            properties: { staffName: { type: "string" } },
          },
          canReassignToShelterStaff: {
            type: "boolean",
            description:
              "True when the caller may PATCH toShelterStaff (destination manager or Admin, In_Progress only)",
          },
          pet: {
            type: "object",
            properties: {
              petAge: { type: "string", example: "~4 yrs" },
              petSex: { type: "string" },
              petColor: { type: "string" },
            },
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
  PetCreate: {
    type: "object",
    description:
      "shelterID is never a body field — taken from the acting Staff member's own shelter, or required separately for Admin (see the endpoint description). petPhoto starts as a placeholder (POST /pets/:id/photos supplies the real one) and adoptionStatus always starts 'available' — neither is client-settable here.",
    required: [
      "breedID",
      "petName",
      "petDOB",
      "petSex",
      "petColor",
      "petSize",
      "intakeDate",
      "petWeight",
      "petHeight",
    ],
    properties: {
      breedID: { type: "integer" },
      petName: { type: "string", maxLength: 45 },
      petDOB: { type: "string", format: "date" },
      petSex: { type: "string", enum: ["M", "F"] },
      petColor: { type: "string", maxLength: 45 },
      petSize: { type: "string", enum: ["Small", "Medium", "Large"] },
      intakeDate: { type: "string", format: "date" },
      petWeight: { type: "number", exclusiveMinimum: 0 },
      petHeight: { type: "number", exclusiveMinimum: 0 },
      petBGroup: {
        type: "string",
        maxLength: 5,
        description: "Optional — defaults to 'N/A' if omitted (often unknown at intake).",
      },
      intakeType: {
        type: "string",
        enum: ["stray", "surrendered", "transferred"],
        nullable: true,
        description: "Optional — how the pet arrived at the shelter.",
      },
      adoptionStatus: {
        type: "string",
        enum: ["incoming", "available", "adopted", "fostered", "transferred", "deceased"],
        description: "Optional — defaults to 'incoming' (not shown in the public catalog until 'available').",
      },
      shelterID: {
        type: "integer",
        description: "Admin only — required for that role, ignored for Staff.",
      },
    },
  },
  PetUpdate: {
    type: "object",
    description:
      "Partial update — send only the fields to change. shelterID reassignment is out of scope (that's a transfer, not a profile edit); petPhoto/adoptionStatus are managed by their own endpoints, not here.",
    properties: {
      breedID: { type: "integer" },
      petName: { type: "string", maxLength: 45 },
      petDOB: { type: "string", format: "date" },
      petSex: { type: "string", enum: ["M", "F"] },
      petColor: { type: "string", maxLength: 45 },
      petSize: { type: "string", enum: ["Small", "Medium", "Large"] },
      intakeDate: { type: "string", format: "date" },
      intakeType: {
        type: "string",
        enum: ["stray", "surrendered", "transferred"],
        nullable: true,
      },
      petWeight: { type: "number", exclusiveMinimum: 0 },
      petHeight: { type: "number", exclusiveMinimum: 0 },
      petBGroup: { type: "string", maxLength: 5 },
      petDesc: { type: "string", maxLength: 500, nullable: true },
      microchipID: { type: "string", maxLength: 45, nullable: true },
      featuredFlag: { type: "boolean" },
      compatibleWithChildren: { type: "boolean" },
      compatibleWithPets: { type: "boolean" },
      specialNeeds: { type: "boolean" },
      adoptionStatus: {
        type: "string",
        enum: [
          "incoming",
          "available",
          "pending",
          "adopted",
          "fostered",
          "transferred",
          "deceased",
        ],
      },
    },
  },
  PetPhoto: {
    type: "object",
    description:
      "isPrimary is computed, not a stored column — true when this row's photoURL matches the pet's current petPhoto.",
    properties: {
      photoID: { type: "integer" },
      photoURL: { type: "string" },
      uploadedAt: { type: "string", format: "date-time" },
      isPrimary: { type: "boolean" },
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

  Shelter: {
    type: "object",
    description:
      "Full shelter record returned by the Admin shelter-management endpoints. lat/lng are derived from the PostGIS shelterLocation column and are null until it has been set.",
    properties: {
      shelterID: { type: "integer" },
      shelterName: { type: "string" },
      shelterAddress: { type: "string" },
      shelterPhone: { type: "string", example: "+12125550101" },
      shelterEmail: { type: "string" },
      shelterZIP: { type: "integer", example: 10001 },
      shelterSize: { type: "integer" },
      shelterStatus: { type: "string", enum: ["Open", "Full", "Closed"] },
      managerStaffID: { type: "integer", nullable: true },
      lat: { type: "number", nullable: true },
      lng: { type: "number", nullable: true },
    },
  },
  ShelterCreate: {
    type: "object",
    required: [
      "shelterName",
      "shelterAddress",
      "shelterPhone",
      "shelterEmail",
      "shelterZIP",
      "shelterSize",
    ],
    properties: {
      shelterName: { type: "string", maxLength: 45 },
      shelterAddress: { type: "string", maxLength: 45 },
      shelterPhone: { type: "string", example: "+12125550101" },
      shelterEmail: { type: "string", maxLength: 45 },
      shelterZIP: { type: "integer", example: 10001 },
      shelterSize: { type: "integer", minimum: 1 },
    },
  },
  StaffListItem: {
    type: "object",
    description:
      "One row of the Admin staff listing. Only STAFF's own columns plus shelterName and userEmail — no other USERS fields (userPassword, refreshToken) are ever included.",
    properties: {
      userID: { type: "integer" },
      avatarSeed: { type: "string" },
      staffName: { type: "string" },
      staffPhone: { type: "string", nullable: true },
      shelterID: { type: "integer", nullable: true },
      staffDOB: { type: "string", format: "date", nullable: true },
      staffSex: { type: "string", nullable: true },
      staffDOJ: { type: "string", format: "date-time", nullable: true },
      staffDOS: { type: "string", format: "date-time", nullable: true },
      staffDesignation: {
        type: "string",
        enum: ["Manager", "Senior", "Associate"],
        nullable: true,
      },
      accountStatus: {
        type: "string",
        description:
          "'Pending' is a self-registered account awaiting admin approval (PATCH /staff/:id/status to 'Active' approves it, 'Deactivated' declines it) — never a state an admin sets directly.",
        enum: ["Pending", "Active", "Deactivated"],
        nullable: true,
      },
      shelter: {
        type: "object",
        nullable: true,
        properties: { shelterName: { type: "string" } },
      },
      user: {
        type: "object",
        properties: { userEmail: { type: "string" } },
      },
    },
  },
  AnalyticsOverview: {
    type: "object",
    description: "Org-wide KPI summary for the Admin dashboard's Overview tab.",
    properties: {
      shelters: {
        type: "object",
        properties: {
          total: { type: "integer" },
          byStatus: {
            type: "object",
            additionalProperties: { type: "integer" },
            example: { Open: 5, Full: 2, Closed: 1 },
          },
        },
      },
      pets: {
        type: "object",
        properties: {
          total: { type: "integer" },
          byStatus: {
            type: "object",
            additionalProperties: { type: "integer" },
            example: { available: 90, incoming: 10, adopted: 30 },
          },
        },
      },
      adopters: {
        type: "object",
        properties: {
          total: { type: "integer" },
          byStatus: {
            type: "object",
            additionalProperties: { type: "integer" },
            example: { Active: 480, Banned: 5, Deactivated: 15 },
          },
        },
      },
      applications: {
        type: "object",
        properties: {
          total: { type: "integer" },
          byStatus: {
            type: "object",
            additionalProperties: { type: "integer" },
            example: { Pending: 50, Accepted: 200, Rejected: 30, Withdrawn: 20 },
          },
          adoptionRate: {
            type: "number",
            nullable: true,
            description:
              "Accepted / total, as a 0-1 fraction rounded to 2dp. null if there are no applications yet.",
            example: 0.67,
          },
        },
      },
    },
  },
  MonthlyStatsPoint: {
    type: "object",
    description: "One calendar month's Intake vs. Adoptions counts.",
    properties: {
      month: { type: "string", example: "Jan" },
      year: { type: "integer", example: 2026 },
      intake: { type: "integer", description: "Pets with an intakeDate in this month." },
      adoptions: {
        type: "integer",
        description:
          "Applications with applicationStatus 'Accepted', by their submission month.",
      },
    },
  },
  ShelterAnalyticsItem: {
    type: "object",
    description:
      "One shelter's capacity-planning breakdown, plus the identifying/contact fields and current manager — enough to drive the Admin Shelters tab (list, status badge, edit-form pre-fill) without a second endpoint.",
    properties: {
      shelterID: { type: "integer" },
      shelterName: { type: "string" },
      shelterAddress: { type: "string" },
      shelterPhone: { type: "string", example: "+12125550101" },
      shelterEmail: { type: "string" },
      shelterZIP: { type: "integer", example: 10001 },
      shelterSize: { type: "integer" },
      shelterStatus: { type: "string", enum: ["Open", "Full", "Closed"] },
      managerStaffID: { type: "integer", nullable: true },
      managerName: { type: "string", nullable: true },
      petCount: { type: "integer" },
      petsByStatus: {
        type: "object",
        additionalProperties: { type: "integer" },
        example: { available: 12, incoming: 3, adopted: 5 },
      },
      openApplicationCount: {
        type: "integer",
        description: "Applications currently Pending at this shelter.",
      },
      staffCount: {
        type: "integer",
        description: "Active staff currently assigned to this shelter.",
      },
      utilization: {
        type: "number",
        nullable: true,
        description:
          "petCount / shelterSize as a percentage rounded to 2dp. null for a 0-capacity shelter.",
        example: 84.0,
      },
    },
  },
  AdopterListItem: {
    type: "object",
    description:
      "One row of the Admin adopter listing. governmentID and stripeCustomerID are never included.",
    properties: {
      userID: { type: "integer" },
      avatarSeed: { type: "string" },
      adopterName: { type: "string" },
      adopterPhone: { type: "string", nullable: true },
      accountStatus: {
        type: "string",
        enum: ["Active", "Banned", "Deactivated"],
        nullable: true,
      },
      adopterRiskFlag: { type: "boolean" },
      preQualifyFlag: { type: "boolean" },
      createdAt: { type: "string", format: "date-time" },
      city: { type: "string" },
      state: { type: "string" },
      country: { type: "string" },
      user: {
        type: "object",
        properties: { userEmail: { type: "string" } },
      },
    },
  },
  StaffDetail: {
    allOf: [
      { $ref: "#/components/schemas/StaffListItem" },
      {
        type: "object",
        properties: {
          managedShelters: {
            type: "array",
            description:
              "Shelter(s), if any, where this staff member is the currently-assigned manager.",
            items: {
              type: "object",
              properties: {
                shelterID: { type: "integer" },
                shelterName: { type: "string" },
              },
            },
          },
        },
      },
    ],
  },
  StaffUpdate: {
    type: "object",
    description:
      "Partial update — send only the fields to change. Account activation is a separate endpoint (PATCH /staff/:id/status).",
    properties: {
      staffDesignation: {
        type: "string",
        enum: ["Manager", "Senior", "Associate"],
      },
      shelterID: {
        type: "integer",
        description:
          "If this staff member currently manages their old shelter, that shelter's managerStaffID is cleared automatically.",
      },
    },
  },
  ShelterUpdate: {
    type: "object",
    description:
      "Partial update — send only the fields to change. shelterLocation is re-derived automatically whenever shelterAddress or shelterZIP is included.",
    properties: {
      shelterName: { type: "string", maxLength: 45 },
      shelterAddress: { type: "string", maxLength: 45 },
      shelterPhone: { type: "string" },
      shelterEmail: { type: "string", maxLength: 45 },
      shelterZIP: { type: "integer" },
      shelterSize: { type: "integer", minimum: 1 },
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
