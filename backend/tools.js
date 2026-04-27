export const toolRegistry = {
  getUserInfo: {
    description: "取得使用者基本資料",
    execute: async ({ userId }) => {
      return {
        name: "Larry Chen",
        department: "Engineering",
        role: "Frontend Engineer"
      };
    },
  },

  getLeaveBalance: {
    description: "查詢使用者剩餘假期",
    execute: async ({ userId }) => {
      return {
        annualLeave: 10,
        sickLeave: 3
      };
    },
  },

  getPaySlip: {
    description: "查詢薪資單",
    execute: async ({ userId, month }) => {
      return {
        month: month ?? "2025-04",
        basicSalary: 5000000,
        bonus: 1000000,
        total: 6000000
      };
    },
  }
};