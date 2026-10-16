import obd

def main():
	conn = obd.OBD()
	print("状態: ", conn.status()
	if not conn.is_connected():
		return
	for cmd in [obd.commands.SPEED, obd.commands.RPM, obd.commands.MAF,
			obd.commands.INTAKE_PRESSURE, obd.commands.INTAKE_TEMP,
			obd.commandsFUEL_RATE]:
		print(cmd.name, conn.query(cmd).value)
	print("対応PID:", sorted(c.name for c in conn.supported_commands))
	conn.close()

if __name__ == "__main__":
	main()
