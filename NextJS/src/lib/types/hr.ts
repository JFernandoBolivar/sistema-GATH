export interface Employee {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  department: Department
  position: string
  startDate: Date
  endDate?: Date | null
  status: "active" | "inactive" | "leave"
  familyMembers: FamilyMember[]
  createdAt: Date
  updatedAt: Date
}

export interface FamilyMember {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  relationship: "spouse" | "child" | "parent" | "sibling" | "other"
  dateOfBirth: Date
  createdAt: Date
}

export interface Movement {
  id: string
  employeeId: string
  employee: Employee
  type: "promotion" | "transfer" | "demotion" | "egress"
  fromDepartment?: Department
  toDepartment?: Department
  fromPosition?: string
  toPosition?: string
  date: Date
  reason?: string
  notes?: string
  createdAt: Date
}

export interface Department {
  id: string
  name: string
  code: string
  employeeCount: number
  budget?: number
}

export interface KPIData {
  activeEmployees: number
  newHires: number
  upcomingEgress: number
  familyMembers: number
  departmentDistribution: Array<{
    name: string
    count: number
    percentage: number
  }>
  recentMovements: Movement[]
}
