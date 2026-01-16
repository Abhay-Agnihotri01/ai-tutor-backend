// Admin Live Class Token Generation
router.post('/live-classes/token/:meetingId', 
  authenticateToken, 
  requireAdmin,
  async (req, res) => {
    const { generateAdminToken } = await import('../controllers/adminLiveClassController.js');
    return generateAdminToken(req, res);
  }
);