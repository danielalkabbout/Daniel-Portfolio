using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Portfolio.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPersonalLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Ref",
                table: "Visits",
                type: "character varying(12)",
                maxLength: 12,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "TrackedLinks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Code = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    Label = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrackedLinks", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Visits_Ref",
                table: "Visits",
                column: "Ref");

            migrationBuilder.CreateIndex(
                name: "IX_TrackedLinks_Code",
                table: "TrackedLinks",
                column: "Code",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TrackedLinks");

            migrationBuilder.DropIndex(
                name: "IX_Visits_Ref",
                table: "Visits");

            migrationBuilder.DropColumn(
                name: "Ref",
                table: "Visits");
        }
    }
}
