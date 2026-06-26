const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');

// Maps the incoming role string to the Prisma enum value, model accessor, and name field
const ROLE_CONFIG = {
  admin:     { roleEnum: 'Admin',        model: 'admin',        nameField: 'adminName'     },
  adopter:   { roleEnum: 'Adopter',      model: 'adopter',      nameField: 'adopterName'   },
  staff:     { roleEnum: 'Staff',        model: 'staff',        nameField: 'staffName'     },
  vet:       { roleEnum: 'Veterinarian', model: 'veterinarian', nameField: 'vetName'       },
  volunteer: { roleEnum: 'Volunteer',    model: 'volunteer',    nameField: 'volunteerName' },
  donor:     { roleEnum: 'Donor',        model: 'donor',        nameField: 'donorName'     },
};

const register = async ({ name, email, password, role }) => {
  const { roleEnum, model, nameField } = ROLE_CONFIG[role];

  const existing = await prisma.users.findUnique({ where: { userEmail: email } });
  if (existing) {
    const err = new Error('A user with this email is already registered');
    err.code = 'CONFLICT';
    throw err;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // Both inserts run atomically — if the role-table insert fails, the Users row is rolled back
  const newUser = await prisma.$transaction(async (tx) => {
    const user = await tx.users.create({
      data: {
        userEmail: email,
        userPassword: hashedPassword,
        role: roleEnum,
      },
    });

    await tx[model].create({
      data: {
        userID: user.userID,
        [nameField]: name,
      },
    });

    return user;
  });

  const { userPassword, ...safeUser } = newUser;
  return safeUser;
};

const login = async ({ email, password }) => {
  const user = await prisma.users.findUnique({ where: { userEmail: email } });
  if (!user) {
    const err = new Error('No account found with this email');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const passwordMatch = await bcrypt.compare(password, user.userPassword);
  if (!passwordMatch) {
    const err = new Error('Incorrect password');
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  const { userPassword, ...safeUser } = user;
  return safeUser;
};

module.exports = { register, login };
