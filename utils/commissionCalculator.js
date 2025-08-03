/**
 * Utility functions for calculating admin commission and worker payments
 */

/**
 * Calculate admin commission and worker payment for a service
 * @param {number} serviceAmount - The service amount (excluding distance charge)
 * @param {number} distanceCharge - The distance charge amount
 * @returns {Object} Object containing adminCommission and workerPayment
 */
export const calculateCommissionAndPayment = (serviceAmount, distanceCharge = 0) => {
  // Admin commission is 20% of service amount only (not distance charge)
  const adminCommission = Math.round(serviceAmount * 0.20);
  
  // Worker payment is service amount minus admin commission
  const workerPayment = serviceAmount - adminCommission;
  
  return {
    adminCommission,
    workerPayment,
    // Total amount remains the same (service + distance charge)
    totalAmount: serviceAmount + distanceCharge
  };
};

/**
 * Calculate commission for multiple services
 * @param {Array} services - Array of service objects with amount and quantity
 * @param {number} distanceCharge - Total distance charge
 * @returns {Object} Object containing total admin commission and worker payments breakdown
 */
export const calculateMultipleServicesCommission = (services, distanceCharge = 0) => {
  let totalServiceAmount = 0;
  let totalAdminCommission = 0;
  let totalWorkerPayment = 0;
  
  const servicesBreakdown = services.map(service => {
    const serviceAmount = service.amount * (service.quantity || 1);
    const { adminCommission, workerPayment } = calculateCommissionAndPayment(serviceAmount);
    
    totalServiceAmount += serviceAmount;
    totalAdminCommission += adminCommission;
    totalWorkerPayment += workerPayment;
    
    return {
      ...service,
      serviceAmount,
      adminCommission,
      workerPayment
    };
  });
  
  return {
    totalServiceAmount,
    totalAdminCommission,
    totalWorkerPayment,
    totalAmount: totalServiceAmount + distanceCharge,
    servicesBreakdown
  };
}; 