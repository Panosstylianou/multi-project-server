# AWS Configuration
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "pocketbase-manager"
}

# Network Configuration
variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "allowed_ssh_cidrs" {
  description = "CIDR blocks allowed for SSH access"
  type        = list(string)
  default     = ["0.0.0.0/0"]  # Restrict in production!
}

variable "allowed_api_cidrs" {
  description = "CIDR blocks allowed for direct API access"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# EC2 Configuration
variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.small"  # 2 vCPU, 2GB RAM - good starting point
}

variable "key_pair_name" {
  description = "Name of the EC2 key pair for SSH access"
  type        = string
}

variable "data_volume_size" {
  description = "Size of the EBS data volume in GB"
  type        = number
  default     = 50
}

# Domain Configuration
variable "domain" {
  description = "Base domain for the PocketBase manager (e.g., pocketbase.youragency.com)"
  type        = string
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID (leave empty to skip DNS setup)"
  type        = string
  default     = ""
}

# Application Configuration
variable "api_key" {
  description = "API key for the management API"
  type        = string
  sensitive   = true
}

variable "admin_email" {
  description = "Admin email for notifications"
  type        = string
}

variable "acme_email" {
  description = "Email for Let's Encrypt SSL certificates"
  type        = string
}

