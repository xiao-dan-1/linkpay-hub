const USER_SESSION_KEY = 'studio-task-workbench:user-session'
const ADMIN_SESSION_KEY = 'studio-task-workbench:admin-session'

export const sessionStore = {
  getUserId: () => localStorage.getItem(USER_SESSION_KEY),
  setUserId: (id: string | null) => {
    if (id) {
      localStorage.setItem(USER_SESSION_KEY, id)
    } else {
      localStorage.removeItem(USER_SESSION_KEY)
    }
  },
  getAdminId: () => localStorage.getItem(ADMIN_SESSION_KEY),
  setAdminId: (id: string | null) => {
    if (id) {
      localStorage.setItem(ADMIN_SESSION_KEY, id)
    } else {
      localStorage.removeItem(ADMIN_SESSION_KEY)
    }
  },
}
