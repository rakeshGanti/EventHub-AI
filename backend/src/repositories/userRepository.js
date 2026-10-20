// This file is about the Prisma data-access layer for user lookup and creation.
const prisma = require('../config/database');

const userRepository = {
  async findByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  },

  async create({ email, password }) {
    return prisma.user.create({ data: { email, password } });
  },
};

module.exports = userRepository;
