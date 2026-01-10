output "server_public_ip" {
  description = "Public IP address of the server"
  value       = aws_eip.server.public_ip
}

output "server_instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.server.id
}

output "manager_url" {
  description = "URL for the PocketBase manager"
  value       = "https://manager.${var.domain}"
}

output "api_url" {
  description = "URL for the management API"
  value       = "https://manager.${var.domain}/api"
}

output "traefik_dashboard_url" {
  description = "URL for Traefik dashboard"
  value       = "https://traefik.${var.domain}"
}

output "s3_backup_bucket" {
  description = "S3 bucket for backups"
  value       = aws_s3_bucket.backups.id
}

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "security_group_id" {
  description = "Security group ID"
  value       = aws_security_group.server.id
}

output "ssh_command" {
  description = "SSH command to connect to the server"
  value       = "ssh -i ${var.key_pair_name}.pem ec2-user@${aws_eip.server.public_ip}"
}

output "ssm_connect_command" {
  description = "AWS SSM command to connect to the server"
  value       = "aws ssm start-session --target ${aws_instance.server.id}"
}

output "dns_records" {
  description = "DNS records to create if not using Route53"
  value = var.route53_zone_id == "" ? {
    main     = "${var.domain} -> ${aws_eip.server.public_ip}"
    wildcard = "*.${var.domain} -> ${aws_eip.server.public_ip}"
  } : null
}

